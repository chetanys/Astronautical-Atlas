#!/usr/bin/env python3
"""Regrid local climate and elevation rasters into the browser grid format."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROWS = 720
COLUMNS = 1440
PIXEL_DEGREES = 0.25
TRANSFORM = from_origin(-180, 90, PIXEL_DEGREES, PIXEL_DEGREES)
CRS = "EPSG:4326"
EXPECTED_BANDS = ("temperature", "elevation", "slope", "aridity")


def regrid_raster(path: str, band: int, scale: float, name: str) -> np.ndarray:
    """Read one local GeoTIFF/NetCDF raster band onto the global grid."""
    try:
        source = rasterio.open(path)
    except rasterio.errors.RasterioError as error:
        raise ValueError(
            f"Could not open {name} raster {path!r}. GeoTIFF paths and "
            'GDAL NetCDF subdataset paths (NETCDF:"file.nc":variable) are supported.'
        ) from error

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

        source_scale = source.scales[band - 1]
        source_offset = source.offsets[band - 1]
        values *= np.float32(scale * source_scale)
        values += np.float32(source_offset * scale)
        return values


def calculate_slope(elevation: np.ndarray) -> np.ndarray:
    """Estimate slope in degrees using geodesic cell spacing."""
    latitude = 90 - (np.arange(ROWS, dtype=np.float64) + 0.5) * PIXEL_DEGREES
    north_south_spacing = PIXEL_DEGREES * 111_320
    east_west_spacing = north_south_spacing * np.cos(np.deg2rad(latitude))

    with np.errstate(invalid="ignore", divide="ignore"):
        north_south_gradient = np.gradient(
            elevation, north_south_spacing, axis=0
        )
        east_west_gradient = (
            np.roll(elevation, -1, axis=1) - np.roll(elevation, 1, axis=1)
        ) / (2 * east_west_spacing[:, np.newaxis])
        slope = np.rad2deg(
            np.arctan(np.hypot(north_south_gradient, east_west_gradient))
        )

    slope[~np.isfinite(elevation)] = np.nan
    return slope.astype(np.float32)


def build_grid(args: argparse.Namespace) -> np.ndarray:
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
    potential_evapotranspiration = regrid_raster(
        args.pet, args.pet_band, args.pet_scale, "potential evapotranspiration"
    )

    with np.errstate(invalid="ignore", divide="ignore"):
        aridity = (
            1 - precipitation / potential_evapotranspiration
        ).clip(0, 1) * 10

    slope = calculate_slope(elevation)
    grid = np.stack((temperature, elevation, slope, aridity), axis=-1)
    invalid = (
        ~np.isfinite(grid).all(axis=2)
        | (potential_evapotranspiration <= 0)
    )
    grid[invalid] = np.nan
    return grid.astype("<f4", copy=False)


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
            help=(
                f"Local raster path for {description}. For NetCDF, use a GDAL "
                'subdataset path such as NETCDF:"climate.nc":tavg.'
            ),
        )
        parser.add_argument(
            f"--{name}-band",
            type=int,
            default=1,
            help=f"1-based band number in the {name} raster (default: 1).",
        )
        parser.add_argument(
            f"--{name}-scale",
            type=float,
            default=1,
            help=f"Additional scale factor for the {name} band (default: 1).",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    add_raster_arguments(parser)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/earth_grid.bin"),
        help="Output path (default: assets/earth_grid.bin).",
    )
    parser.add_argument(
        "--citation",
        action="append",
        required=True,
        default=[],
        help="Source citation to write to the JSON metadata sidecar; repeat as needed.",
    )
    args = parser.parse_args()

    grid = build_grid(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    grid.tofile(args.output)

    metadata = {
        "rows": ROWS,
        "columns": COLUMNS,
        "cellSizeDegrees": PIXEL_DEGREES,
        "valueOrder": EXPECTED_BANDS,
        "units": ["degrees Celsius", "metres", "degrees", "dryness score / 10"],
        "aridityFormula": "10 * clamp(1 - annual precipitation / annual PET, 0, 1)",
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

    valid_cells = int(np.isfinite(grid[:, :, 0]).sum())
    print(
        f"Wrote {args.output}: {valid_cells:,} valid cells, "
        f"{args.output.stat().st_size:,} bytes."
    )
    print(f"Wrote source metadata to {metadata_path}.")


if __name__ == "__main__":
    main()
