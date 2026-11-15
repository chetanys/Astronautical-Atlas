#!/usr/bin/env python3
"""Build a land-only, approximately 15 km equal-area Earth search grid."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds

CRS = "EPSG:6933"
SOURCE_CRS = "EPSG:4326"
CELL_SIZE_METERS = 15_000
BOUNDS = transform_bounds(
    SOURCE_CRS, CRS, -180, -90, 180, 90, densify_pts=21
)
LEFT, BOTTOM, RIGHT, TOP = BOUNDS
COLUMNS = math.ceil((RIGHT - LEFT) / CELL_SIZE_METERS)
ROWS = math.ceil((TOP - BOTTOM) / CELL_SIZE_METERS)
TRANSFORM = from_origin(LEFT, TOP, CELL_SIZE_METERS, CELL_SIZE_METERS)
EXPECTED_BANDS = ("temperature", "elevation", "slope", "aridity")


def regrid_raster(path: str, band: int, scale: float, name: str) -> np.ndarray:
    """Reproject one raster band onto the shared equal-area grid."""
    try:
        source = rasterio.open(path)
    except rasterio.errors.RasterioError as error:
        raise ValueError(f"Could not open {name} raster {path!r}.") from error

    with source:
        if source.crs is None:
            raise ValueError(f"{name} raster {path!r} has no coordinate reference system.")
        if band < 1 or band > source.count:
            raise ValueError(
                f"{name} band {band} is outside the available "
                f"band range 1–{source.count}."
            )

        values = np.full((ROWS, COLUMNS), np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(source, band),
            destination=values,
            src_transform=source.transform,
            src_crs=source.crs,
            src_nodata=source.nodatavals[band - 1],
            dst_transform=TRANSFORM,
            dst_crs=CRS,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
            init_dest_nodata=True,
        )

        values *= np.float32(scale * source.scales[band - 1])
        values += np.float32(scale * source.offsets[band - 1])
        return values


def calculate_slope(elevation: np.ndarray) -> np.ndarray:
    """Estimate regional slope and correct equal-area map scale by latitude."""
    gradient_y, gradient_x = np.gradient(
        elevation, CELL_SIZE_METERS, CELL_SIZE_METERS
    )
    row_y = TOP - (np.arange(ROWS, dtype=np.float64) + 0.5) * CELL_SIZE_METERS
    row_x = np.full(ROWS, (LEFT + RIGHT) / 2, dtype=np.float64)
    _, row_latitude = Transformer.from_crs(
        CRS, SOURCE_CRS, always_xy=True
    ).transform(row_x, row_y)

    latitude_cosine = np.maximum(np.cos(np.deg2rad(row_latitude)), 1e-6)
    scale_x = np.cos(np.deg2rad(30)) / latitude_cosine
    scale_y = latitude_cosine / np.cos(np.deg2rad(30))
    slope = np.rad2deg(
        np.arctan(
            np.hypot(
                gradient_x * scale_x[:, np.newaxis],
                gradient_y * scale_y[:, np.newaxis],
            )
        )
    )
    slope[~np.isfinite(elevation)] = np.nan
    return slope.astype(np.float32)


def build_grid(args: argparse.Namespace) -> tuple[np.ndarray, dict[str, int]]:
    temperature = regrid_raster(
        args.temperature, args.temperature_band, args.temperature_scale, "temperature"
    )
    elevation = regrid_raster(
        args.elevation, args.elevation_band, args.elevation_scale, "elevation"
    )
    precipitation = regrid_raster(
        args.precipitation,
        args.precipitation_band,
        args.precipitation_scale,
        "precipitation",
    )
    pet = regrid_raster(args.pet, args.pet_band, args.pet_scale, "potential evapotranspiration")

    with np.errstate(invalid="ignore", divide="ignore"):
        aridity = (1 - precipitation / pet).clip(0, 1) * 10
    slope = calculate_slope(elevation)
    base_valid = (
        np.isfinite(temperature)
        & np.isfinite(elevation)
        & np.isfinite(slope)
        & np.isfinite(aridity)
        & (pet > 0)
    )
    nasa_counts = {
        "modisTemperatureCells": 0,
        "nasademElevationCells": 0,
        "nasademSlopeCells": 0,
    }
    if args.nasa_grid is not None:
        with rasterio.open(args.nasa_grid) as nasa:
            expected_transform = TRANSFORM
            if (
                nasa.crs is None
                or nasa.crs.to_string() != CRS
                or nasa.width != COLUMNS
                or nasa.height != ROWS
                or not np.allclose(
                    tuple(nasa.transform)[:6],
                    tuple(expected_transform)[:6],
                    rtol=0,
                    atol=1e-5,
                )
                or nasa.count < 4
            ):
                raise ValueError(
                    "NASA layer export must be a four-band GeoTIFF aligned to "
                    f"the {CELL_SIZE_METERS:,} m {CRS} grid "
                    f"({COLUMNS} columns × {ROWS} rows)."
                )
            expected_bands = (
                "modis_day_lst_c",
                "modis_night_lst_c",
                "nasadem_elevation_m",
                "nasadem_slope_100m_deg",
            )
            if tuple(nasa.descriptions[:4]) != expected_bands:
                raise ValueError(
                    "NASA layer bands must be ordered and named: "
                    + ", ".join(expected_bands)
                    + ". Re-export with scripts/export_nasa_earth_layers.js."
                )

            bands = nasa.read((1, 2, 3, 4), masked=True, out_dtype="float32")
            day_lst = bands[0]
            night_lst = bands[1]
            nasa_elevation = bands[2]
            nasa_slope = bands[3]
            valid_lst = (
                ~np.ma.getmaskarray(day_lst)
                & ~np.ma.getmaskarray(night_lst)
                & np.isfinite(day_lst.data)
                & np.isfinite(night_lst.data)
            )
            valid_elevation = (
                ~np.ma.getmaskarray(nasa_elevation)
                & np.isfinite(nasa_elevation.data)
            )
            valid_slope = (
                ~np.ma.getmaskarray(nasa_slope)
                & np.isfinite(nasa_slope.data)
            )
            temperature[valid_lst] = (
                day_lst.data[valid_lst] + night_lst.data[valid_lst]
            ) / 2
            elevation[valid_elevation] = nasa_elevation.data[valid_elevation]
            slope[valid_slope] = nasa_slope.data[valid_slope]
            nasa_counts = {
                "modisTemperatureCells": int((valid_lst & base_valid).sum()),
                "nasademElevationCells": int((valid_elevation & base_valid).sum()),
                "nasademSlopeCells": int((valid_slope & base_valid).sum()),
            }

    valid = (
        np.isfinite(temperature)
        & np.isfinite(elevation)
        & np.isfinite(slope)
        & np.isfinite(aridity)
        & (pet > 0)
    )
    if not valid.any():
        raise ValueError("No land cells have valid values across all four fields.")

    row_indices, column_indices = np.nonzero(valid)
    x = LEFT + (column_indices + 0.5) * CELL_SIZE_METERS
    y = TOP - (row_indices + 0.5) * CELL_SIZE_METERS
    longitude, latitude = Transformer.from_crs(
        CRS, SOURCE_CRS, always_xy=True
    ).transform(x, y)

    records = np.column_stack(
        (
            latitude,
            longitude,
            temperature[valid],
            elevation[valid],
            slope[valid],
            aridity[valid],
        )
    ).astype("<f4", copy=False)
    score_scales = {
        name: float(
            np.percentile(records[:, index], 95)
            - np.percentile(records[:, index], 5)
        )
        for index, name in enumerate(EXPECTED_BANDS, start=2)
    }
    return records, {
        "validLandCells": int(valid.sum()),
        "candidateGridCells": int(ROWS * COLUMNS),
        "scoreScales": score_scales,
        **nasa_counts,
    }


def add_raster_arguments(parser: argparse.ArgumentParser) -> None:
    for name, description in (
        ("temperature", "mean temperature in °C"),
        ("elevation", "elevation in metres"),
        ("precipitation", "annual precipitation in millimetres"),
        ("pet", "annual potential evapotranspiration in millimetres"),
    ):
        parser.add_argument(
            f"--{name}",
            required=True,
            help=f"Local raster path for {description}.",
        )
        parser.add_argument(f"--{name}-band", type=int, default=1)
        parser.add_argument(f"--{name}-scale", type=float, default=1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    add_raster_arguments(parser)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/earth_grid.bin"),
        help="Output record file (default: assets/earth_grid.bin).",
    )
    parser.add_argument(
        "--nasa-grid",
        type=Path,
        help=(
            "Optional aligned four-band Earth Engine export: MODIS daytime LST "
            "(°C), nighttime LST (°C), NASADEM elevation (m), and 100 m-baseline "
            "slope (degrees)."
        ),
    )
    parser.add_argument("--period", required=True, help="Source observation period.")
    parser.add_argument(
        "--citation",
        action="append",
        required=True,
        default=[],
        help="Source citation and license; repeat for each source.",
    )
    args = parser.parse_args()

    records, counts = build_grid(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    records.tofile(args.output)
    metadata = {
        "schemaVersion": 2,
        "projection": "EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global)",
        "cellSizeMeters": CELL_SIZE_METERS,
        "rows": ROWS,
        "columns": COLUMNS,
        "candidateGridCells": counts["candidateGridCells"],
        "pointCount": counts["validLandCells"],
        "latitudeCoverage": {
            "minimum": float(records[:, 0].min()),
            "maximum": float(records[:, 0].max()),
        },
        "recordStride": 6,
        "recordValueOrder": [
            "latitude",
            "longitude",
            *EXPECTED_BANDS,
        ],
        "valueOrder": EXPECTED_BANDS,
        "units": [
            "degrees Celsius",
            "metres",
            "degrees",
            "dryness score / 10",
        ],
        "scoreScales": counts["scoreScales"],
        "scoreNormalization": (
            "Equal-weight absolute differences divided by each field's "
            "90% observed data spread (95th minus 5th percentile)."
        ),
        "sourcePeriod": args.period,
        "temperatureDefinition": (
            "MODIS MOD11A2 v061 clear-QA day/night LST midpoint in °C where "
            "available; otherwise TerraClimate annual mean air temperature. "
            "This is a mixed surface/air temperature field and must not be "
            "interpreted as a uniform physical measurement."
            if args.nasa_grid is not None
            else "TerraClimate annual mean air temperature in °C."
        ),
        "elevationDefinition": (
            "NASADEM v001 elevation (EGM96 geoid) where available; otherwise "
            "the existing WorldClim 2.1 elevation input."
            if args.nasa_grid is not None
            else "WorldClim 2.1 elevation."
        ),
        "landMask": "Valid cells with complete temperature, elevation, slope and aridity inputs; ocean/no-data cells omitted.",
        "aridityFormula": "10 * clamp(1 - annual precipitation / annual PET, 0, 1)",
        "slopeMethod": (
            (
                "Earth Engine NASADEM v001 elevation aggregated to a 100 m grid, "
                "slope derived with the Horn method, then averaged into 15 km cells; "
                "WorldClim-derived 15 km slope is retained where NASADEM is absent."
                if args.nasa_grid is not None
                else "Derived from elevation regridded to 15 km; local equal-area map-scale "
                "factors corrected by latitude. Regional screening only."
            )
        ),
        "nasaLayerCoverage": {
            "modisTemperatureCells": counts["modisTemperatureCells"],
            "nasademElevationCells": counts["nasademElevationCells"],
            "nasademSlopeCells": counts["nasademSlopeCells"],
            "totalSourceCoveredCells": counts["validLandCells"],
            "fallbacks": (
                {
                    "temperature": "TerraClimate 2025 annual mean air temperature",
                    "elevation": "WorldClim 2.1 elevation",
                    "slope": "WorldClim-derived 15 km slope",
                }
                if args.nasa_grid is not None
                else None
            ),
        },
        "inputBands": {
            "temperature": {"band": args.temperature_band, "scale": args.temperature_scale},
            "elevation": {"band": args.elevation_band, "scale": args.elevation_scale},
            "precipitation": {"band": args.precipitation_band, "scale": args.precipitation_scale},
            "pet": {"band": args.pet_band, "scale": args.pet_scale},
        },
        "citations": args.citation,
    }
    metadata_path = args.output.with_suffix(".json")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {args.output}: {counts['validLandCells']:,} land cells at "
        f"{CELL_SIZE_METERS:,} m equal-area resolution "
        f"({args.output.stat().st_size:,} bytes)."
    )
    print(f"Wrote source metadata to {metadata_path}.")


if __name__ == "__main__":
    main()
