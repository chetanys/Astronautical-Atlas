#!/usr/bin/env python3
"""Build a precomputed MODIS cache for a site's JSON list using AppEEARS."""

from __future__ import annotations

import argparse
import base64
import csv
import getpass
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_BASE = "https://appeears.earthdatacloud.nasa.gov/api"
PRODUCT = "MOD11A2.061"
LAYERS = ("LST_Day_1km", "LST_Night_1km", "QC_Day", "QC_Night")


def api_request(path: str, *, token: str | None = None,
                basic_auth: tuple[str, str] | None = None,
                payload: dict[str, Any] | None = None) -> Any:
    headers = {"Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if basic_auth:
        raw_auth = f"{basic_auth[0]}:{basic_auth[1]}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(raw_auth).decode('ascii')}"
        body = b""
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=body,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            content = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"AppEEARS HTTP {error.code} at {path}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach AppEEARS at {path}: {error.reason}") from error
    if not content:
        return {}
    try:
        return json.loads(content)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"AppEEARS returned invalid JSON at {path}.") from error


def login() -> str:
    username = input("NASA Earthdata Login username: ").strip()
    password = getpass.getpass("NASA Earthdata Login password (hidden): ")
    if not username or not password:
        raise RuntimeError("Earthdata username and password are required.")
    response = api_request("/login", basic_auth=(username, password))
    token = response.get("token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("AppEEARS login response did not contain an access token.")
    return token


def read_sites(path: Path) -> list[dict[str, Any]]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Could not read valid sites JSON at {path}: {error}") from error
    if isinstance(document, dict):
        document = document.get("sites")
    if not isinstance(document, list) or not document:
        raise RuntimeError("The sites JSON must be a non-empty array (or an object with a sites array).")

    sites: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(document):
        if not isinstance(item, dict):
            raise RuntimeError(f"Site entry {index} is not a JSON object.")
        name = str(item.get("name") or item.get("id") or f"site_{index + 1}")
        cache_id = str(item.get("id") or item.get("name") or f"site_{index + 1}")
        site_id = re.sub(r"[^A-Za-z0-9_-]+", "_", cache_id).strip("_")
        if not site_id or site_id in seen_ids or cache_id in seen_ids:
            raise RuntimeError(f"Missing or duplicate site id at entry {index}: {cache_id!r}.")
        seen_ids.update((site_id, cache_id))
        lat_value = item.get("lat")
        lon_value = item.get("lon")
        if lat_value is None:
            lat_value = item.get("latitude")
        if lon_value is None:
            lon_value = item.get("longitude")
        if (
            isinstance(lat_value, bool)
            or isinstance(lon_value, bool)
            or not isinstance(lat_value, (int, float, str))
            or not isinstance(lon_value, (int, float, str))
        ):
            raise RuntimeError(f"Site {name!r} must include numeric lat/lon.")
        try:
            lat = float(lat_value)
            lon = float(lon_value)
        except (TypeError, ValueError) as error:
            raise RuntimeError(f"Site {name!r} must include numeric lat/lon.") from error
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise RuntimeError(f"Site {name!r} has coordinates outside valid ranges.")
        sites.append({
            "id": site_id, "cache_id": cache_id, "name": name, "lat": lat, "lon": lon
        })
    return sites


def submit_task(token: str, sites: list[dict[str, Any]],
                start_year: int, end_year: int) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    response = api_request("/task", token=token, payload={
        "task_type": "point",
        "task_name": f"Otherworld-MOD11A2-{stamp}",
        "params": {
            "dates": [{"startDate": f"01-01-{start_year}",
                       "endDate": f"12-31-{end_year}"}],
            "layers": [{"product": PRODUCT, "layer": layer} for layer in LAYERS],
            "coordinates": [{"id": site["id"], "category": "scan",
                             "latitude": site["lat"], "longitude": site["lon"]}
                            for site in sites],
        },
    })
    task_id = response.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError(f"AppEEARS did not return task_id: {response!r}")
    return task_id


def wait_for_task(token: str, task_id: str, poll_seconds: int,
                  timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    while True:
        task = api_request(f"/task/{task_id}", token=token)
        status = task.get("status")
        print(f"AppEEARS task {task_id}: {status or 'unknown'}")
        if status == "done":
            return
        if status in {"error", "failed", "cancelled"}:
            raise RuntimeError(f"AppEEARS task {task_id} failed: {task!r}")
        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"Task is still {status!r}; resume with --task-id {task_id}."
            )
        time.sleep(poll_seconds)


def download_csvs(token: str, task_id: str, output_dir: Path) -> list[Path]:
    bundle = api_request(f"/bundle/{task_id}", token=token)
    csv_files = [item for item in bundle.get("files", [])
                 if item.get("file_type") == "csv"]
    if not csv_files:
        raise RuntimeError("Completed AppEEARS task contains no CSV result files.")
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for item in csv_files:
        file_id = item.get("file_id")
        filename = Path(str(item.get("file_name", ""))).name
        expected_hash = item.get("sha256")
        if not file_id or not filename or not expected_hash:
            raise RuntimeError(f"Incomplete AppEEARS bundle file record: {item!r}")
        request = urllib.request.Request(
            f"{API_BASE}/bundle/{task_id}/{file_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                content = response.read()
        except (urllib.error.HTTPError, urllib.error.URLError) as error:
            raise RuntimeError(f"Could not download AppEEARS result {filename}: {error}") from error
        if hashlib.sha256(content).hexdigest().lower() != str(expected_hash).lower():
            raise RuntimeError(f"SHA-256 checksum mismatch for {filename}.")
        path = output_dir / filename
        path.write_bytes(content)
        paths.append(path)
    return paths


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def layer_value(row: dict[str, str], layer: str) -> str | None:
    wanted = normalized(layer)
    for key, value in row.items():
        if wanted in normalized(key):
            return value
    return None


def row_site_id(row: dict[str, str], sites: list[dict[str, Any]],
                path: Path) -> str | None:
    ids = {site["id"]: site["id"] for site in sites}
    ids.update({site["name"]: site["id"] for site in sites})
    filename = normalized(path.stem)
    for name, site_id in ids.items():
        if normalized(name) == filename:
            return site_id

    for key, value in row.items():
        if normalized(key) in {"id", "site", "siteid", "locationid"}:
            match = ids.get(value) or ids.get(value.strip())
            if match:
                return match

    values = {normalized(key): value for key, value in row.items()}
    lat_text = next((value for key, value in values.items()
                     if key in {"latitude", "lat"}), None)
    lon_text = next((value for key, value in values.items()
                     if key in {"longitude", "lon", "long"}), None)
    if lat_text is not None and lon_text is not None:
        try:
            lat, lon = float(lat_text), float(lon_text)
        except ValueError:
            return None
        matches = [site for site in sites
                   if abs(site["lat"] - lat) <= 0.002
                   and abs(site["lon"] - lon) <= 0.002]
        if len(matches) == 1:
            return matches[0]["id"]
    return None


def parse_results(paths: list[Path], sites: list[dict[str, Any]],
                  scale: float, start_year: int, end_year: int) -> dict[str, Any]:
    totals: dict[str, dict[str, list[float]]] = {
        site["id"]: {"day": [], "night": []} for site in sites
    }
    site_by_id = {site["id"]: site for site in sites}
    for path in paths:
        with path.open(newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if not reader.fieldnames:
                raise RuntimeError(f"AppEEARS result has no CSV header: {path}")
            headers = {normalized(name) for name in reader.fieldnames}
            required = [normalized(layer) for layer in LAYERS]
            if not all(any(name in header for header in headers) for name in required):
                raise RuntimeError(f"AppEEARS CSV does not contain all LST/QC layers: {path}")
            for row in reader:
                site_id = row_site_id(row, sites, path)
                if site_id is None:
                    if len(sites) == 1:
                        site_id = sites[0]["id"]
                    else:
                        raise RuntimeError(
                            f"Cannot associate a CSV row in {path} with an input site. "
                            "Expected an id or latitude/longitude column."
                        )
                if site_id not in site_by_id:
                    raise RuntimeError(f"AppEEARS returned an unexpected site id {site_id!r}.")
                for period in ("day", "night"):
                    raw = layer_value(row, f"LST_{period.title()}_1km")
                    qc_raw = layer_value(row, f"QC_{period.title()}")
                    if raw is None or qc_raw is None:
                        continue
                    try:
                        value = float(raw)
                        quality = int(float(qc_raw))
                    except ValueError:
                        continue
                    if not (quality & 0b11) == 0 or value <= 0:
                        continue
                    kelvin = value * scale if value > 1000 else value
                    if 100 <= kelvin <= 400:
                        totals[site_id][period].append(kelvin - 273.15)

    cache_sites: dict[str, Any] = {}
    for site_id, values in totals.items():
        combined = values["day"] + values["night"]
        if not combined:
            print(f"No good-QA MODIS LST observations for {site_id}; omitted.")
            continue
        cache_id = site_by_id[site_id]["cache_id"]
        cache_sites[cache_id] = {
            "id": cache_id,
            "lat": site_by_id[site_id]["lat"],
            "lon": site_by_id[site_id]["lon"],
            "mean_lst_c": round(sum(combined) / len(combined), 1),
            "mean_day_lst_c": round(sum(values["day"]) / len(values["day"]), 1)
            if values["day"] else None,
            "mean_night_lst_c": round(sum(values["night"]) / len(values["night"]), 1)
            if values["night"] else None,
            "valid_observations": len(combined),
        }
    if not cache_sites:
        raise RuntimeError("No QA-valid MODIS observations were parsed; cache not written.")
    return {
        "schemaVersion": 1,
        "product": PRODUCT,
        "sourceUrl": "https://doi.org/10.5067/MODIS/MOD11A2.061",
        "period": f"{start_year}-{end_year}",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "qualityRule": "MOD11A2 QC mandatory bits 0-1 equal 0; LST scale factor applied to raw DN.",
        "sites": cache_sites,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sites_json", type=Path, help="Top-sites JSON exported by the web app.")
    parser.add_argument("--start-year", type=int, default=2020)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--output", type=Path, default=Path("assets/modis_cache.json"))
    parser.add_argument("--download-dir", type=Path, default=Path("data/appeears"))
    parser.add_argument("--task-id", help="Resume waiting and download for an existing task.")
    parser.add_argument("--poll-seconds", type=int, default=30)
    parser.add_argument("--timeout-seconds", type=int, default=21600)
    args = parser.parse_args()
    current_year = datetime.now(timezone.utc).year
    if not (2000 <= args.start_year <= args.end_year <= current_year):
        parser.error("Years must satisfy 2000 <= start-year <= end-year <= current year.")
    if args.poll_seconds < 1 or args.timeout_seconds < 1:
        parser.error("--poll-seconds and --timeout-seconds must be positive.")
    try:
        sites = read_sites(args.sites_json)
        token = login()
        if args.task_id:
            task_id = args.task_id
        else:
            task_id = submit_task(token, sites, args.start_year, args.end_year)
            print(f"Submitted {len(sites)}-site {PRODUCT} task: {task_id}")
        wait_for_task(token, task_id, args.poll_seconds, args.timeout_seconds)
        csv_paths = download_csvs(token, task_id, args.download_dir)
        catalog = api_request(f"/product/{PRODUCT}")
        missing_layers = [
            layer for layer in LAYERS
            if catalog.get(layer, {}).get("Available") is not True
        ]
        if missing_layers:
            raise RuntimeError(
                f"{PRODUCT} is missing available layers: {', '.join(missing_layers)}"
            )
        scale = float(catalog["LST_Day_1km"]["ScaleFactor"])
        cache = parse_results(csv_paths, sites, scale, args.start_year, args.end_year)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(cache, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote precomputed MODIS cache for {len(cache['sites'])} sites to {args.output}")
    except (RuntimeError, TimeoutError, OSError, KeyError, TypeError, ValueError) as error:
        print(f"AppEEARS site cache build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
