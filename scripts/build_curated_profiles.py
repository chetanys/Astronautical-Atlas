#!/usr/bin/env python3
"""Build compact, source-filtered Moon/Mars reference profiles from workbooks."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "curated_reference_profiles.json"
TRUSTED_EXACT_HOSTS = {
    "doi.org",
    "hal.sorbonne-universite.fr",
    "link.springer.com",
    "mdpi-res.com",
    "physicstoday.aip.org",
    "pmc.ncbi.nlm.nih.gov",
    "seismosoc.secure-platform.com",
    "www.dlr.de",
    "www.science.org",
}
TRUSTED_HOST_SUFFIXES = (
    ".nasa.gov",
    ".usgs.gov",
    ".esa.int",
    ".swri.org",
    ".edu",
)
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+")
MEASURED_CELL = re.compile(r"^(.*?)\s*\[([^\]]+)\]\s*$")


def trusted_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    match = URL_PATTERN.search(value.strip())
    if not match:
        return None
    url = match.group(0).rstrip(".,;)")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        return None
    if host not in TRUSTED_EXACT_HOSTS and not host.endswith(TRUSTED_HOST_SUFFIXES):
        return None
    return url


def trusted_urls(value: Any) -> list[str]:
    if not isinstance(value, str):
        return []
    urls: list[str] = []
    for candidate in URL_PATTERN.findall(value):
        url = trusted_url(candidate)
        if url and url not in urls:
            urls.append(url)
    return urls


def cell_text(value: Any) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def header_indexes(headers: tuple[Any, ...], required: tuple[str, ...]) -> dict[str, int]:
    indexes = {
        str(value).strip(): index
        for index, value in enumerate(headers)
        if value is not None
    }
    missing = [name for name in required if name not in indexes]
    if missing:
        raise ValueError(f"Workbook is missing required columns: {', '.join(missing)}")
    return indexes


def read_mars_profiles(path: Path) -> tuple[list[dict[str, Any]], dict[str, int]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if "Master (Long)" not in workbook.sheetnames:
            raise ValueError(f"{path.name} has no 'Master (Long)' worksheet.")
        rows = workbook["Master (Long)"].iter_rows(values_only=True)
        headers = next(rows, None)
        if headers is None:
            raise ValueError(f"{path.name} has an empty 'Master (Long)' worksheet.")
        indexes = header_indexes(
            headers,
            (
                "Terrain Type",
                "Terrain Name",
                "Parameter",
                "Data",
                "Confidence",
                "Agency",
                "Source title(s)",
                "Source URL(s)",
                "Primary source URL",
            ),
        )
        profiles: dict[str, dict[str, Any]] = {}
        included_rows = 0
        excluded_rows = 0
        for row in rows:
            name = cell_text(row[indexes["Terrain Name"]])
            if not name:
                continue
            if cell_text(row[indexes["Confidence"]]).casefold() != "measured":
                excluded_rows += 1
                continue
            primary = trusted_url(row[indexes["Primary source URL"]])
            if not primary:
                candidates = trusted_urls(row[indexes["Source URL(s)"]])
                primary = candidates[0] if candidates else None
            if not primary:
                excluded_rows += 1
                continue
            value = cell_text(row[indexes["Data"]])
            parameter = cell_text(row[indexes["Parameter"]])
            if not value or not parameter:
                excluded_rows += 1
                continue

            title = cell_text(row[indexes["Source title(s)"]])
            agency = cell_text(row[indexes["Agency"]])
            profile = profiles.setdefault(
                name,
                {
                    "id": f"mars-{len(profiles) + 1}",
                    "body": "Mars",
                    "name": name,
                    "terrainTypes": [],
                    "parameters": [],
                    "sources": [],
                },
            )
            terrain_type = cell_text(row[indexes["Terrain Type"]])
            if terrain_type and terrain_type not in profile["terrainTypes"]:
                profile["terrainTypes"].append(terrain_type)

            record = {
                "name": parameter,
                "value": value,
                "confidence": "Measured (workbook label)",
                "agency": agency,
                "sourceTitle": title or agency or "Source cited in workbook",
                "sourceUrl": primary,
            }
            key = (record["name"], record["value"], record["sourceUrl"])
            if not any(
                (item["name"], item["value"], item["sourceUrl"]) == key
                for item in profile["parameters"]
            ):
                profile["parameters"].append(record)
                included_rows += 1
            source = {"title": record["sourceTitle"], "url": primary}
            if source not in profile["sources"]:
                profile["sources"].append(source)

        result = sorted(profiles.values(), key=lambda item: item["name"].casefold())
        return result, {
            "inputRowsIncluded": included_rows,
            "inputRowsExcluded": excluded_rows,
        }
    finally:
        workbook.close()


def read_moon_profiles(path: Path) -> tuple[list[dict[str, Any]], dict[str, int]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if "Master" not in workbook.sheetnames:
            raise ValueError(f"{path.name} has no 'Master' worksheet.")
        rows = workbook["Master"].iter_rows(values_only=True)
        headers = next(rows, None)
        if headers is None:
            raise ValueError(f"{path.name} has an empty 'Master' worksheet.")
        indexes = header_indexes(
            headers,
            ("Terrain Type", "Terrain Name", "Coordinates / sites", "Source links"),
        )
        omitted = {
            indexes["Terrain Type"],
            indexes["Terrain Name"],
            indexes["Coordinates / sites"],
            indexes["Source links"],
        }
        profiles: list[dict[str, Any]] = []
        included_fields = 0
        excluded_fields = 0
        for row in rows:
            name = cell_text(row[indexes["Terrain Name"]])
            if not name:
                continue
            sources = trusted_urls(row[indexes["Source links"]])
            if not sources:
                continue
            parameters = []
            for index, header in enumerate(headers):
                if index in omitted:
                    continue
                raw = cell_text(row[index])
                match = MEASURED_CELL.fullmatch(raw)
                if not match:
                    if raw:
                        excluded_fields += 1
                    continue
                confidence = cell_text(match.group(2))
                confidence_lower = confidence.casefold()
                if (
                    not confidence_lower.startswith("measured")
                    or any(
                        term in confidence_lower
                        for term in ("estimated", "not verified", "proxy", "not measured")
                    )
                ):
                    excluded_fields += 1
                    continue
                parameters.append(
                    {
                        "name": cell_text(header),
                        "value": cell_text(match.group(1)),
                        "confidence": confidence,
                    }
                )
                included_fields += 1
            if not parameters:
                continue
            profiles.append(
                {
                    "id": f"moon-{len(profiles) + 1}",
                    "body": "Moon",
                    "name": name,
                    "terrainTypes": [cell_text(row[indexes["Terrain Type"]])],
                    "parameters": parameters,
                    "sources": [
                        {"title": urlparse(url).hostname or "Source", "url": url}
                        for url in sources
                    ],
                    "sourceNote": (
                        "The workbook provides citations at profile level, not for each field."
                    ),
                }
            )
        profiles.sort(key=lambda item: item["name"].casefold())
        return profiles, {
            "inputFieldsIncluded": included_fields,
            "inputFieldsExcluded": excluded_fields,
        }
    finally:
        workbook.close()


def build(args: argparse.Namespace) -> dict[str, Any]:
    mars_profiles, mars_counts = read_mars_profiles(args.mars_workbook)
    moon_profiles, moon_counts = read_moon_profiles(args.moon_workbook)
    profiles = mars_profiles + moon_profiles
    return {
        "schemaVersion": 1,
        "generatedOn": date.today().isoformat(),
        "filtering": {
            "mars": (
                "Only rows labelled exactly Measured with a primary HTTPS citation "
                "on an agency, university, DOI, or recognized scientific-publisher domain."
            ),
            "moon": (
                "Only profile fields tagged Measured without estimated/proxy/not-verified "
                "qualifiers; profile-level citations are retained separately."
            ),
            "globalScan": (
                "These are reference profiles only. They are never sent to or scored by "
                "the Earth-grid worker."
            ),
        },
        "excludedWorkbooks": [
            {
                "file": "ice water earth analog.xlsx",
                "reason": (
                    "Contains 207 place names, but its ice/water min, max, and mean "
                    "measurement cells are blank and no row-level citations are provided."
                ),
            },
            {
                "file": "Terrain_Mineral_Composition.xlsx",
                "reason": (
                    "Its own data-quality note says oxide ranges are lithology-based "
                    "estimates, not measurements or row-by-row cited values. The "
                    "numbered copies supplied with it are excluded for the same reason."
                ),
            },
            {
                "file": "Moon_Full_Dataset.xlsx",
                "reason": (
                    "Contains global Moon facts rather than site-specific reference "
                    "measurements; it is not used as a site profile or scan input."
                ),
            },
            {
                "file": "mars_terrain_master.xlsx",
                "reason": (
                    "Not used by this build: the selected research workbook is the "
                    "Mars input because it supplies explicit confidence labels and "
                    "row-level source fields for filtering."
                ),
            },
        ],
        "inputs": [
            {
                "file": args.mars_workbook.name,
                "sheet": "Master (Long)",
                **mars_counts,
            },
            {
                "file": args.moon_workbook.name,
                "sheet": "Master",
                **moon_counts,
            },
        ],
        "profiles": profiles,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mars-workbook", type=Path, required=True)
    parser.add_argument("--moon-workbook", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    for path in (args.mars_workbook, args.moon_workbook):
        if not path.is_file():
            parser.error(f"workbook not found: {path}")
    document = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(document['profiles'])} curated reference profiles "
        f"to {args.output}."
    )


if __name__ == "__main__":
    main()
