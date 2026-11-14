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
        "landMask": "Valid WorldClim elevation cells; ocean/no-data cells omitted.",
        "aridityFormula": "10 * clamp(1 - annual precipitation / annual PET, 0, 1)",
        "slopeMethod": (
            "Derived from elevation regridded to 15 km; local equal-area map-scale "
            "factors corrected by latitude. Regional screening only."
        ),
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
