#!/usr/bin/env python3
"""Verify AppEEARS catalog access and download a one-site MODIS point task."""

from __future__ import annotations

import argparse
import base64
import csv
import getpass
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_BASE = "https://appeears.earthdatacloud.nasa.gov/api"
MODIS_PRODUCT = "MOD11A2.061"
NASADEM_PRODUCT = "NASADEM_NC.001"
MODIS_LAYERS = ("LST_Day_1km", "LST_Night_1km", "QC_Day", "QC_Night")


def api_request(
    path: str,
    *,
    token: str | None = None,
    basic_auth: tuple[str, str] | None = None,
    payload: dict[str, Any] | None = None,
) -> Any:
    headers = {"Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if basic_auth:
        encoded = base64.b64encode(
            f"{basic_auth[0]}:{basic_auth[1]}".encode("utf-8")
        ).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"
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
        with urllib.request.urlopen(request, timeout=60) as response:
            response_body = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"AppEEARS returned HTTP {error.code} for {path}: {detail}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach AppEEARS at {path}: {error.reason}") from error

    if not response_body:
        return {}
    try:
        return json.loads(response_body)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"AppEEARS returned invalid JSON for {path}.") from error


def verify_catalog() -> None:
    modis = api_request(f"/product/{MODIS_PRODUCT}")
    missing_modis = [
        layer
        for layer in MODIS_LAYERS
        if layer not in modis or modis[layer].get("Available") is not True
    ]
    if missing_modis:
        raise RuntimeError(
            f"{MODIS_PRODUCT} is missing available layers: "
            + ", ".join(missing_modis)
        )

    nasadem = api_request(f"/product/{NASADEM_PRODUCT}")
    if (
        "NASADEM_HGT" not in nasadem
        or nasadem["NASADEM_HGT"].get("Available") is not True
    ):
        raise RuntimeError(
            f"{NASADEM_PRODUCT} does not expose an available NASADEM_HGT layer."
        )

    print(f"Verified AppEEARS product: {MODIS_PRODUCT}")
    for layer in MODIS_LAYERS:
        info = modis[layer]
        quality = info.get("QualityLayers") or "none listed"
        print(
            f"  {layer}: {info.get('Units') or 'unitless'}; "
            f"scale={info.get('ScaleFactor') or 'none'}; QA={quality}"
        )
    print(
        f"Verified AppEEARS product: {NASADEM_PRODUCT} "
        "(NASADEM_HGT, metres; static elevation)"
    )


def read_site(site_name: str, csv_path: Path) -> dict[str, str]:
    try:
        with csv_path.open(newline="", encoding="utf-8") as file:
            sites = list(csv.DictReader(file))
    except OSError as error:
        raise RuntimeError(f"Could not read site list {csv_path}: {error}") from error

    for site in sites:
        if site.get("name") == site_name:
            try:
                latitude = float(site["latitude"])
                longitude = float(site["longitude"])
            except (KeyError, ValueError) as error:
                raise RuntimeError(
                    f"Site {site_name!r} has invalid coordinates in {csv_path}."
                ) from error
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise RuntimeError(f"Site {site_name!r} is outside valid coordinates.")
            return {
                "name": site_name,
                "latitude": str(latitude),
                "longitude": str(longitude),
            }
    available = ", ".join(site.get("name", "") for site in sites)
    raise RuntimeError(
        f"Unknown site {site_name!r} in {csv_path}. Available sites: {available}"
    )


def login() -> str:
    username = os.environ.get("EARTHDATA_USERNAME") or input(
        "NASA Earthdata Login username: "
    ).strip()
    if not username:
        raise RuntimeError("An Earthdata Login username is required.")
    password = getpass.getpass("NASA Earthdata Login password (hidden): ")
    if not password:
        raise RuntimeError("An Earthdata Login password is required.")

    response = api_request("/login", basic_auth=(username, password))
    token = response.get("token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("AppEEARS login response did not contain an access token.")
    return token


def submit_task(token: str, site: dict[str, str], year: int) -> str:
    task_name = "Otherworld-MOD11A2-" + datetime.now(timezone.utc).strftime(
        "%Y%m%d%H%M%S"
    )
    payload = {
        "task_type": "point",
        "task_name": task_name,
        "params": {
            "dates": [
                {
                    "startDate": f"01-01-{year}",
                    "endDate": f"12-31-{year}",
                }
            ],
            "layers": [
                {"product": MODIS_PRODUCT, "layer": layer}
                for layer in MODIS_LAYERS
            ],
            "coordinates": [
                {
                    "id": re.sub(r"[^A-Za-z0-9_-]+", "_", site["name"]).strip("_"),
                    "category": "known-site-access-test",
                    "latitude": float(site["latitude"]),
                    "longitude": float(site["longitude"]),
                }
            ],
        },
    }
    response = api_request("/task", token=token, payload=payload)
    task_id = response.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError(
            "AppEEARS did not return a task_id: "
            + json.dumps(response, ensure_ascii=True)
        )
    return task_id


def wait_for_task(
    token: str,
    task_id: str,
    *,
    poll_seconds: int,
    timeout_seconds: int,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    while True:
        task = api_request(f"/task/{task_id}", token=token)
        status = task.get("status")
        print(f"Task {task_id}: {status or 'unknown status'}")
        if status == "done":
            return
        if status in {"error", "failed", "cancelled"}:
            raise RuntimeError(
                f"AppEEARS task {task_id} ended with status {status}: "
                f"{task.get('error') or task.get('summary') or 'no error details'}"
            )
        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"Task {task_id} is still {status!r}. Re-run with "
                f"--task-id {task_id} to resume polling and download."
            )
        time.sleep(poll_seconds)


def download_csv_bundle(
    token: str,
    task_id: str,
    output_dir: Path,
) -> list[Path]:
    bundle = api_request(f"/bundle/{task_id}", token=token)
    files = bundle.get("files")
    if not isinstance(files, list):
        raise RuntimeError(f"AppEEARS bundle for task {task_id} has no file list.")

    csv_files = [item for item in files if item.get("file_type") == "csv"]
    if not csv_files:
        raise RuntimeError(
            f"AppEEARS completed task {task_id} without a CSV result. "
            "Inspect the bundle response and task summary."
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for item in csv_files:
        file_id = item.get("file_id")
        filename = Path(str(item.get("file_name", ""))).name
        expected_hash = item.get("sha256")
        if not file_id or not filename or not expected_hash:
            raise RuntimeError(
                f"AppEEARS returned an incomplete CSV bundle entry: {item!r}"
            )
        request = urllib.request.Request(
            f"{API_BASE}/bundle/{task_id}/{file_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Could not download AppEEARS file {filename}: "
                f"HTTP {error.code}: {detail}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Could not download AppEEARS file {filename}: {error.reason}"
            ) from error

        actual_hash = hashlib.sha256(content).hexdigest()
        if actual_hash.lower() != str(expected_hash).lower():
            raise RuntimeError(
                f"Checksum mismatch for AppEEARS file {filename}: "
                f"expected {expected_hash}, received {actual_hash}."
            )
        destination = output_dir / filename
        destination.write_bytes(content)
        saved.append(destination)
        first_lines = content.decode("utf-8-sig", errors="replace").splitlines()[:2]
        print(f"Downloaded and verified {destination} ({len(content):,} bytes)")
        for line in first_lines:
            print(f"  {line}")
    return saved


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog-only",
        action="store_true",
        help="Verify product and layer names without Earthdata credentials.",
    )
    parser.add_argument(
        "--site",
        default="Mauna Kea",
        help="Exact site name from assets/known_sites.csv (default: Mauna Kea).",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2020,
        help="Calendar year for the MODIS test (default: 2020).",
    )
    parser.add_argument(
        "--task-id",
        help="Resume polling/downloading an existing AppEEARS task instead of submitting.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=30,
        help="Seconds between status checks (default: 30).",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=3600,
        help="Maximum wait for a task (default: 3600).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/appeears"),
        help="Directory for verified point-result CSV files.",
    )
    args = parser.parse_args()
    if args.poll_seconds < 1 or args.timeout_seconds < 1:
        parser.error("--poll-seconds and --timeout-seconds must be positive.")
    if not 2000 <= args.year <= datetime.now(timezone.utc).year:
        parser.error("--year must be between 2000 and the current calendar year.")

    try:
        verify_catalog()
        if args.catalog_only:
            return 0

        token = login()
        if args.task_id:
            task_id = args.task_id
        else:
            site = read_site(args.site, Path("assets/known_sites.csv"))
            task_id = submit_task(token, site, args.year)
            print(f"Submitted one-point {MODIS_PRODUCT} task: {task_id}")
        wait_for_task(
            token,
            task_id,
            poll_seconds=args.poll_seconds,
            timeout_seconds=args.timeout_seconds,
        )
        download_csv_bundle(token, task_id, args.output_dir)
    except (RuntimeError, TimeoutError) as error:
        print(f"AppEEARS access test failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
