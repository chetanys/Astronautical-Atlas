#!/usr/bin/env python3
"""Download one TerraClimate year and prepare rasters for the global grid."""

from __future__ import annotations

import argparse
import shutil
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import rasterio

TERRACLIMATE_BASE = (
    "http://thredds.northwestknowledge.net:8080/thredds/fileServer/"
    "TERRACLIMATE_ALL/data"
)
WORLDCLIM_ELEVATION_URL = (
    "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/"
    "wc2.1_2.5m_elev.zip"
)
CLIMATE_VARIABLES = ("tmin", "tmax", "ppt", "pet")


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size:
        print(f"Using cached {destination}")
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    print(f"Downloading {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "OtherworldAtlas/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            with temporary.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def scaled_band(dataset: rasterio.DatasetReader, band: int) -> np.ma.MaskedArray:
    values = dataset.read(band, masked=True, out_dtype="float32")
    return values * dataset.scales[band - 1] + dataset.offsets[band - 1]


def write_float_raster(path: Path, values: np.ndarray, source_profile: dict) -> None:
    profile = source_profile.copy()
    profile.update(
        driver="GTiff",
        count=1,
        dtype="float32",
        nodata=np.nan,
        compress="deflate",
        predictor=3,
        tiled=True,
        blockxsize=256,
        blockysize=256,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", **profile) as output:
        output.write(values.astype(np.float32, copy=False), 1)


def prepare_temperature(tmin_path: Path, tmax_path: Path, output_path: Path) -> None:
    with rasterio.open(f'NETCDF:"{tmin_path}":tmin') as tmin, rasterio.open(
        f'NETCDF:"{tmax_path}":tmax'
    ) as tmax:
        if tmin.count != 12 or tmax.count != 12:
            raise ValueError("TerraClimate temperature sources must contain 12 monthly bands.")
        if tmin.count != tmax.count or tmin.shape != tmax.shape:
            raise ValueError("TerraClimate min/max temperature rasters do not align.")

        total = np.zeros(tmin.shape, dtype=np.float32)
        count = np.zeros(tmin.shape, dtype=np.uint8)
        for band in range(1, tmin.count + 1):
            low = scaled_band(tmin, band)
            high = scaled_band(tmax, band)
            valid = ~np.ma.getmaskarray(low) & ~np.ma.getmaskarray(high)
            total[valid] += ((low.data[valid] + high.data[valid]) / 2).astype(
                np.float32
            )
            count[valid] += 1

        annual_mean = np.full(tmin.shape, np.nan, dtype=np.float32)
        valid = count > 0
        annual_mean[valid] = total[valid] / count[valid]
        write_float_raster(output_path, annual_mean, tmin.profile)


def prepare_annual_total(source_path: Path, variable: str, output_path: Path) -> None:
    with rasterio.open(f'NETCDF:"{source_path}":{variable}') as source:
        if source.count != 12:
            raise ValueError(
                f"TerraClimate {variable} source must contain 12 monthly bands; "
                f"found {source.count}."
            )
        total = np.zeros(source.shape, dtype=np.float32)
        count = np.zeros(source.shape, dtype=np.uint8)
        for band in range(1, source.count + 1):
            values = scaled_band(source, band)
            valid = ~np.ma.getmaskarray(values)
            total[valid] += values.data[valid]
            count[valid] += 1

        annual_total = np.full(source.shape, np.nan, dtype=np.float32)
        valid = count > 0
        annual_total[valid] = total[valid]
        write_float_raster(output_path, annual_total, source.profile)


def extract_elevation(archive: Path, output_directory: Path) -> Path:
    output_directory.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as source:
        rasters = [
            item for item in source.infolist()
            if Path(item.filename).suffix.lower() in {".tif", ".tiff"}
        ]
        if len(rasters) != 1:
            raise ValueError(
                f"Expected one elevation GeoTIFF in {archive}, found {len(rasters)}."
            )
        member = rasters[0]
        destination = output_directory / Path(member.filename).name
        if not destination.exists():
            with source.open(member) as compressed, destination.open("wb") as output:
                shutil.copyfileobj(compressed, output, length=1024 * 1024)
        return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    if not 1958 <= args.year <= 2025:
        parser.error("TerraClimate data years must be between 1958 and 2025.")

    raw_climate = args.data_dir / "raw" / "terraclimate"
    raw_worldclim = args.data_dir / "raw" / "worldclim"
    processed = args.data_dir / "processed"
    raw_paths = {}
    for variable in CLIMATE_VARIABLES:
        filename = f"TerraClimate_{variable}_{args.year}.nc"
        path = raw_climate / filename
        download(f"{TERRACLIMATE_BASE}/{filename}", path)
        raw_paths[variable] = path

    elevation_archive = raw_worldclim / "wc2.1_2.5m_elev.zip"
    download(WORLDCLIM_ELEVATION_URL, elevation_archive)
    elevation_path = extract_elevation(elevation_archive, processed / "worldclim")

    temperature_path = processed / f"temperature_{args.year}.tif"
    precipitation_path = processed / f"precipitation_{args.year}.tif"
    pet_path = processed / f"pet_{args.year}.tif"
    prepare_temperature(
        raw_paths["tmin"], raw_paths["tmax"], temperature_path
    )
    prepare_annual_total(raw_paths["ppt"], "ppt", precipitation_path)
    prepare_annual_total(raw_paths["pet"], "pet", pet_path)

    print(f"Temperature: {temperature_path}")
    print(f"Elevation:   {elevation_path}")
    print(f"Precipitation: {precipitation_path}")
    print(f"PET:         {pet_path}")
    print("This is a single-year snapshot, not a climate normal.")
    print("Confirm the source archive lists all 12 monthly bands before using it.")


if __name__ == "__main__":
    main()
