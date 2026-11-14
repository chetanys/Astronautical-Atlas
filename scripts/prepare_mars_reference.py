#!/usr/bin/env python3
"""Build a source-preserving Mars-region reference file from supplied tables."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np

MOLA_URL = (
    "https://pds-geosciences.wustl.edu/mgs/"
    "urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img"
)
MOLA_LABEL_URL = MOLA_URL.removesuffix(".img") + ".lbl"
MARS_TABLE_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1xwWp7ROM-iG7aUbV6ZCepV-GE52H5dx1DMxkSwaQgZ0/edit"
)
EARTH_DEFINITIONS_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1ghYV-n_hK3eVJARYupg1Bw61aMQOhtTAIrUHWf23mog/edit"
)
LUNAR_DEFINITIONS_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1isKULZdfIeRs2tJ2pnld8Zt39ovk8vLZS_bUmYmyqQM/edit"
)
MOLA_ROWS = 720
MOLA_COLUMNS = 1440
MOLA_RADIUS_METERS = 3_396_000
MOLA_SPACING_DEGREES = 0.25
MARS_TABLE = Path("assets/source-data/mars_regions.csv")
EARTH_DEFINITIONS = Path("assets/source-data/earth_analog_parameter_definitions.csv")
LUNAR_DEFINITIONS = Path("assets/source-data/lunar_parameter_definitions.csv")


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(
        url, headers={"User-Agent": "OtherworldAtlas/1.0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            with temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def read_table(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open(newline="", encoding="utf-8-sig") as source:
        rows = list(csv.reader(source))
    if not rows:
        raise ValueError(f"Source table {path} is empty.")
    width = len(rows[0])
    malformed = [number for number, row in enumerate(rows[1:], 2) if len(row) != width]
    if malformed:
        raise ValueError(
            f"{path} has rows with inconsistent column counts: {malformed[:10]}"
        )
    return rows[0], rows[1:]


def numeric(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        result = float(value.strip())
    except (AttributeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def read_mola(path: Path) -> np.ndarray:
    expected_bytes = MOLA_ROWS * MOLA_COLUMNS * 2
    if path.stat().st_size != expected_bytes:
        raise ValueError(
            f"MOLA image is {path.stat().st_size:,} bytes; "
            f"expected {expected_bytes:,} from its PDS label."
        )
    return np.fromfile(path, dtype=">i2").astype(np.float32).reshape(
        MOLA_ROWS, MOLA_COLUMNS
    )


def mola_slope(elevation: np.ndarray) -> np.ndarray:
    latitude = 90 - (np.arange(MOLA_ROWS) + 0.5) * MOLA_SPACING_DEGREES
    north_south_spacing = (
        MOLA_RADIUS_METERS * math.radians(MOLA_SPACING_DEGREES)
    )
    east_west_spacing = north_south_spacing * np.maximum(
        np.cos(np.deg2rad(latitude)), 1e-6
    )
    north_south_gradient = np.gradient(
        elevation, north_south_spacing, axis=0
    )
    east_west_gradient = (
        np.roll(elevation, -1, axis=1) - np.roll(elevation, 1, axis=1)
    ) / (2 * east_west_spacing[:, np.newaxis])
    return np.rad2deg(
        np.arctan(np.hypot(north_south_gradient, east_west_gradient))
    )


def mola_index(latitude: float, longitude: float) -> tuple[int, int]:
    row = int(round((90 - latitude) / MOLA_SPACING_DEGREES - 0.5))
    column = int(round((longitude % 360) / MOLA_SPACING_DEGREES - 0.5))
    return min(max(row, 0), MOLA_ROWS - 1), column % MOLA_COLUMNS


def longitude_center(longitude_range: str) -> float | None:
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)([WE])\s*", longitude_range)
    if not match:
        return None
    west_or_east = -1 if match.group(3) == "W" else 1
    return west_or_east * (float(match.group(1)) + float(match.group(2))) / 2


def build_reference(
    mola_path: Path, mola_label_path: Path
) -> dict[str, Any]:
    label = mola_label_path.read_text(encoding="ascii")
    for field in (
        r"LINES\s*=\s*720\b",
        r"LINE_SAMPLES\s*=\s*1440\b",
        r"SAMPLE_TYPE\s*=\s*MSB_INTEGER\b",
        r"UNIT\s*=\s*METER\b",
    ):
        if not re.search(field, label):
            raise ValueError(f"MOLA label {mola_label_path} failed validation: {field}")

    headers, rows = read_table(MARS_TABLE)
    header_index = {name.strip(): index for index, name in enumerate(headers)}
    required = (
        "MC",
        "Name",
        "Centre lat (deg)",
        "center lon (Deg)",
    )
    missing = [name for name in required if name not in header_index]
    if missing:
        raise ValueError(f"Mars table is missing required columns: {missing}")

    elevation = read_mola(mola_path)
    slope = mola_slope(elevation)
    regions = []
    for row in rows:
        values = row + [""] * (len(headers) - len(row))
        get = lambda key: values[header_index[key]].strip()
        latitude = numeric(get("Centre lat (deg)"))
        longitude = numeric(get("center lon (Deg)"))
        longitude_from_range = longitude is None
        if longitude is None:
            longitude = longitude_center(get("Lon range (deg)"))
        mola_elevation = None
        mola_slope_value = None
        mola_aggregation = None
        if latitude is not None and longitude is not None:
            mola_row, mola_column = mola_index(latitude, longitude)
            mola_elevation = float(elevation[mola_row, mola_column])
            mola_slope_value = float(slope[mola_row, mola_column])
            mola_aggregation = "nearest 0.25-degree center pixel"
        elif latitude is not None and get("Lon range (deg)").lower() == "all":
            mola_row, _ = mola_index(latitude, 0)
            mola_elevation = float(np.mean(elevation[mola_row]))
            mola_slope_value = float(np.mean(slope[mola_row]))
            mola_aggregation = "mean across all longitudes at center latitude"

        regions.append(
            {
                "id": get("MC"),
                "name": get("Name"),
                "centerLatitude": latitude,
                "centerLongitude": longitude,
                "longitudeDerivedFromRange": longitude_from_range,
                "spreadsheetMeanElevationKm": numeric(
                    get("1. Mean elevation (km)")
                ),
                "spreadsheetMeanSlopeDeg": numeric(
                    get("2. Mean slope (deg, typical km-scale)")
                ),
                "spreadsheetMeanAnnualTemperatureC": numeric(
                    get("9. Mean annual temp (C)")
                ),
                "spreadsheetMeanPressurePa": numeric(
                    get("8. Atmospheric pressure (Pa)")
                ),
                "molaTopographyMeters": mola_elevation,
                "molaSlopeDegrees": mola_slope_value,
                "molaAggregation": mola_aggregation,
                "sourceValues": values,
            }
        )

    earth_columns, earth_rows = read_table(EARTH_DEFINITIONS)
    lunar_columns, lunar_rows = read_table(LUNAR_DEFINITIONS)
    return {
        "schemaVersion": 1,
        "generatedOn": date.today().isoformat(),
        "marsDataset": {
            "source": (
                "User-provided Mars region spreadsheet; source values preserved, "
                "but individual observations and methods were not independently verified."
            ),
            "sourceUrl": MARS_TABLE_URL,
            "sourceColumns": headers,
            "regions": regions,
        },
        "molaDataset": {
            "source": MOLA_URL,
            "label": MOLA_LABEL_URL,
            "product": "MGS MOLA MEGDR topography, 4 pixels per degree",
            "observationPeriod": "1997-09-15 through 2001-06-30",
            "archiveNotice": (
                "PDS4 bundle migrated/updated in 2026; source topography is based "
                "on MGS observations from 1997–2001."
            ),
            "spatialResolution": "0.25 degree; about 14.818 km per pixel at equator",
            "verticalUnit": "metres relative to the MOLA areoid",
            "derivedSlope": (
                "Slope derived by central differences from the 0.25-degree "
                "topography grid; regional terrain context, not traversability."
            ),
        },
        "parameterDefinitions": {
            "earth": {
                "sourceUrl": EARTH_DEFINITIONS_URL,
                "columns": earth_columns,
                "rows": earth_rows,
            },
            "moon": {
                "sourceUrl": LUNAR_DEFINITIONS_URL,
                "columns": lunar_columns,
                "rows": lunar_rows,
            },
        },
        "commercialUseNotice": (
            "Spreadsheet reuse rights are asserted by the project owner. "
            "Underlying scientific values, methods, and source citations still "
            "require independent verification before commercial or safety-critical use."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mola-image",
        type=Path,
        default=Path("data/raw/mars/megt90n000cb.img"),
    )
    parser.add_argument(
        "--mola-label",
        type=Path,
        default=Path("data/raw/mars/megt90n000cb.lbl"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/mars_reference.json"),
    )
    args = parser.parse_args()
    download(MOLA_URL, args.mola_image)
    download(MOLA_LABEL_URL, args.mola_label)
    for source in (MARS_TABLE, EARTH_DEFINITIONS, LUNAR_DEFINITIONS):
        if not source.is_file():
            raise FileNotFoundError(f"Required supplied table is missing: {source}")

    reference = build_reference(args.mola_image, args.mola_label)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(reference, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(reference['marsDataset']['regions'])} Mars region records and "
        f"{len(reference['parameterDefinitions']['earth']['rows'])} Earth / "
        f"{len(reference['parameterDefinitions']['moon']['rows'])} lunar definitions "
        f"to {args.output}."
    )


if __name__ == "__main__":
    main()
