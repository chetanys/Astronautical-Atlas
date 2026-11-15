"""Astronautical Atlas API

Single-file analogue model service: workbook loading, coordinate processing,
quadrangle lookup, weighted Earth-similarity ranking and the FastAPI routes.
"""


"""Earth analogue similarity ranking engine.

Uses a provisional weighted-distance method.
This is not a trained machine-learning classifier.
Missing values are excluded from scoring.
"""

import math
from functools import lru_cache
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


EARTH_ROW_START = 2


def _num(value):
    if value is None:
        return None

    try:
        x = pd.to_numeric(value, errors="coerce")

        if pd.isna(x):
            return None

        x = float(x)

        return x if math.isfinite(x) else None

    except (TypeError, ValueError):
        return None


def _find_site(sheets, sheet_name, place):

    df = sheets.get(sheet_name)

    if df is None:
        return None

    # Special handling for the Daytime hours worksheet.
    if sheet_name == "Daytime hours":

        first_col = df.columns[0]

        rows = df[
            df[first_col].astype(str).str.strip()
            == str(place).strip()
        ]

        return None if rows.empty else rows.iloc[0]

    if "Place name" not in df.columns:
        return None

    rows = df[
        df["Place name"].astype(str).str.strip()
        == str(place).strip()
    ]

    return None if rows.empty else rows.iloc[0]


def _earth_value(sheets, place, sheet, column):

    row = _find_site(sheets, sheet, place)

    if row is None or column not in row.index:
        return None

    return _num(row[column])


def _mars_target(row):

    values = {}

    mean_columns = {
        "elevation": "Mean.2",
        "slope": "Mean.3",
        "igneous": "Mean.4",
        "sedimentary": "Mean.5",
        "metamorphic": "Mean.6",
        "olivine": "Mean.7",
        "pyroxene": "Mean.8",
        "plagioclase": "Mean.9",
        "clays": "Mean.10",
        "sulfates": "Mean.11",
        "iron_oxides": "Mean.12",
        "carbonates": "Mean.13",
        "pressure": "Mean.15",
        "temperature": "Mean.16",
        "water_ice": "Mean.17",
        "humidity": "Mean.18",
        "wind": "Mean.19",
        "daylight_summer": "Mean.20",
        "daylight_winter": "Mean.21",
        "radiation": "Mean.22",
    }

    for key, col in mean_columns.items():

        if col in row.index:
            values[key] = _num(row[col])

    # Mars elevation is stored in kilometres.
    # Earth elevation is stored in metres.
    if values.get("elevation") is not None:
        values["elevation"] *= 1000.0

    values["marsquake"] = _num(row.get("Value"))
    values["volcanic"] = _num(row.get("Value.1"))

    return values


def _moon_target(row):

    cols = {

        "elevation": "T01 AVG elevation",
        "slope": "T02 AVG slope",

        "plagioclase": "M01 Plagioclase AVG",
        "pyroxene": "M02 Pyroxene AVG",
        "olivine": "M03 Olivine AVG",

        "iron_oxides": "C01 FeO AVG",
        "tio2": "C02 TiO2 AVG",
        "mgo": "C03 MgO AVG",
        "alumina": "C04 Al2O3 AVG",
        "cao": "C05 CaO AVG",

        "roughness": "T04 Surface roughness rank",
        "temperature": "T08 Mean annual surface temperature",
        "ice": "T10 Avg % Ice ",

        "daylight_summer": "T13 Mean Daylight at LS 90",
        "daylight_winter": "T14 Mean Daylight at LS 270",

        "moonquakes": "T18 Moonquakes",
        "volcanic": "T19 Avg % Volcanoes",
    }

    return {
        key: _num(row.get(col))
        for key, col in cols.items()
    }


def _earth_features(body, sheets, place):

    common = {

        "elevation": ("ALTITUDE & RELIEF", "Unnamed: 5"),
        "slope": ("SLOPE", "Unnamed: 5"),

        "temperature": ("TEMP", "Unnamed: 5"),
        "pressure": ("PRESSURE", "Unnamed: 5"),
        "humidity": ("humidity", "Unnamed: 5"),
        "wind": ("Wind Speed", "Unnamed: 5"),

        "radiation": ("Radiation", "Unnamed: 5"),

        "daylight_summer": ("Daytime hours", "Unnamed: 10"),
        "daylight_winter": ("Daytime hours", "Unnamed: 13"),

        "ice": ("icewater ", "Unnamed: 5"),

        "marsquake": ("Earthquakes", "Unnamed: 5"),
        "moonquakes": ("Earthquakes", "Unnamed: 5"),

        "volcanic": ("volcanic activity", "Unnamed: 5"),

        "roughness": ("roughness", "Roughness Scale (1-5)"),
    }

    result = {}

    for key, (sheet, column) in common.items():

        result[key] = _earth_value(
            sheets,
            place,
            sheet,
            column
        )


    # Mineralogy data
    mineral_row = _find_site(
        sheets,
        "Mineralology",
        place
    )

    mineral_mean_columns = {

        "iron_oxides": "Unnamed: 5",
        "tio2": "Unnamed: 9",
        "mgo": "Unnamed: 13",
        "alumina": "Unnamed: 17",
        "cao": "Unnamed: 21",

        "olivine": "Unnamed: 25",
        "pyroxene": "Unnamed: 29",
        "plagioclase": "Unnamed: 33",

        "clays": "Unnamed: 37",
        "sulfates": "Unnamed: 41",
        "carbonates": "Unnamed: 45",
    }

    for key, column in mineral_mean_columns.items():

        if mineral_row is not None:
            result[key] = _num(
                mineral_row.get(column)
            )
        else:
            result[key] = None


    # Rock profile
    rock_row = _find_site(
        sheets,
        "Rock profile",
        place
    )

    if rock_row is not None:

        result["sedimentary"] = _num(
            rock_row.get("Unnamed: 5")
        )

        result["igneous"] = _num(
            rock_row.get("Unnamed: 8")
        )

        result["metamorphic"] = _num(
            rock_row.get("Unnamed: 11")
        )

    else:

        result["sedimentary"] = None
        result["igneous"] = None
        result["metamorphic"] = None


    # Lunar atmosphere is not comparable to Earth's atmosphere.
    if body.lower() == "moon":

        result["pressure"] = None
        result["humidity"] = None
        result["wind"] = None

        # Lunar ordinal thermal inertia is not SI-compatible.
        result["thermal_inertia"] = None

    return result


def _feature_definitions(body):

    if body.lower() == "mars":

        keys = [

            "elevation",
            "slope",

            "igneous",
            "sedimentary",
            "metamorphic",

            "olivine",
            "pyroxene",
            "plagioclase",

            "clays",
            "sulfates",
            "iron_oxides",

            "temperature",
            "water_ice",
            "wind",

            "daylight_summer",
            "daylight_winter",
            "radiation",
        ]

        labels = {

            "elevation": "Mean elevation",
            "slope": "Mean slope",

            "igneous": "Igneous rock",
            "sedimentary": "Sedimentary rock",
            "metamorphic": "Metamorphic rock",

            "olivine": "Olivine",
            "pyroxene": "Pyroxene",
            "plagioclase": "Plagioclase",

            "clays": "Clays",
            "sulfates": "Sulfates",
            "iron_oxides": "Iron oxides",

            "temperature": "Annual mean temperature",
            "water_ice": "Near-surface water/ice",
            "wind": "Wind speed",

            "daylight_summer": "Daylight at Ls 90",
            "daylight_winter": "Daylight at Ls 270",

            "radiation": "Radiation",
        }

    else:

        keys = [

            "elevation",
            "slope",

            "plagioclase",
            "pyroxene",
            "olivine",

            "iron_oxides",
            "tio2",
            "mgo",
            "alumina",
            "cao",

            "roughness",
            "temperature",
            "ice",
        ]

        labels = {

            "elevation": "Mean elevation",
            "slope": "Mean slope",

            "plagioclase": "Plagioclase",
            "pyroxene": "Pyroxene",
            "olivine": "Olivine",

            "iron_oxides": "FeO",
            "tio2": "TiO₂",
            "mgo": "MgO",
            "alumina": "Al₂O₃",
            "cao": "CaO",

            "roughness": "Surface roughness",
            "temperature": "Mean annual temperature",
            "ice": "Ice percentage",
        }

    return [
        (key, labels[key], 1.0)
        for key in keys
    ]


# Screening cuts on the field similarity, not validated failure rates.
BREAK_THRESHOLD = 40.0
CAUTION_THRESHOLD = 70.0

# Why a scored field can still mislead, per field label.
MINERAL_CAVEAT = (
    "Abundances come from different techniques (orbital spectroscopy versus "
    "site sampling), and the supplied sheets mix fractions with percentages, "
    "so a large gap can be a unit-basis difference rather than real geology."
)

PARAMETER_CAVEATS = {
    "Mean elevation": (
        "Earth heights use the geoid, Mars heights the areoid and the Moon a "
        "mean radius; equal numbers are not a shared reference surface."
    ),
    "Mean slope": (
        "A workbook mean slope is compared with regional screening slopes "
        "(MOLA orbit fits for Mars); neither resolves rover-scale obstacles."
    ),
    "Annual mean temperature": (
        "An annual mean hides the day-night and seasonal swing that actually "
        "drives thermal design."
    ),
    "Mean annual temperature": (
        "An annual mean hides the day-night swing that actually drives thermal "
        "design and power planning."
    ),
    "Wind speed": (
        "An annual mean hides the gusts that lift dust and load structures."
    ),
    "Radiation": (
        "Totals come from different instruments and spectral coverage; a "
        "similar number is not the same dose or spectrum."
    ),
    "Daylight at Ls 90": (
        "Geometric illumination only; dust, horizon and terrain shadowing are "
        "not included."
    ),
    "Daylight at Ls 270": (
        "Geometric illumination only; dust, horizon and terrain shadowing are "
        "not included."
    ),
    "Surface roughness": (
        "The lunar sheet stores an ordinal rank, so the comparison is "
        "order-of-magnitude only."
    ),
    "Near-surface water/ice": (
        "Definitions differ: subsurface ice indicators on Mars versus surface "
        "ice cover on Earth."
    ),
    "Ice percentage": (
        "Surface ice cover on Earth is not the same quantity as inferred lunar "
        "ice content."
    ),
}

for _label in (
    "Igneous rock", "Sedimentary rock", "Metamorphic rock",
    "Olivine", "Pyroxene", "Plagioclase", "Clays", "Sulfates",
    "Iron oxides", "FeO", "TiO₂", "MgO", "Al₂O₃", "CaO",
):
    PARAMETER_CAVEATS[_label] = MINERAL_CAVEAT

# Fields the supplied sheets contain but the model does not score at all.
REFERENCE_ONLY = {
    "mars": (
        (
            "Surface pressure",
            "Mars mean surface pressure is about 0.6 kPa; no Earth site is "
            "within an order of magnitude, so the term would only measure "
            "distance to vacuum.",
        ),
        (
            "Relative humidity",
            "Reported on a different basis from Earth shelter-level humidity, "
            "so the supplied units are not directly comparable.",
        ),
        (
            "Carbonates",
            "Not reported consistently for both bodies, so a difference would "
            "score one body's data gap rather than the terrain.",
        ),
        (
            "Marsquakes",
            "Ordinal event descriptors, not a physical measurement comparable "
            "with Earth seismicity.",
        ),
        (
            "Volcanic activity",
            "An ordinal activity class, not a comparable physical rate.",
        ),
    ),
    "moon": (
        (
            "Atmospheric pressure",
            "The Moon has no appreciable atmosphere, so Earth pressure has no "
            "lunar counterpart.",
        ),
        (
            "Relative humidity",
            "No lunar humidity measurement exists at this resolution.",
        ),
        (
            "Wind speed",
            "The lunar exosphere is effectively vacuum, so there is no wind "
            "field to compare.",
        ),
        (
            "Thermal inertia",
            "Supplied as an ordinal rank, not SI units, so it cannot be "
            "differenced with Earth values.",
        ),
        (
            "Moonquakes",
            "Ordinal event descriptors, not a physical measurement comparable "
            "with Earth seismicity.",
        ),
        (
            "Volcanic activity",
            "An ordinal activity class, not a comparable physical rate.",
        ),
    ),
}


def _missing_reason(target_value, earth_value):
    if target_value is None and earth_value is None:
        return (
            "No planetary value in the supplied sheet and no Earth measurement, "
            "so this field is dropped from the score."
        )
    if target_value is None:
        return "The supplied planetary sheet has no value for this field."
    return "The Earth workbook has no measurement for this field at this site."


def _assess(body, fields, not_scored, possible_weight, available_weight):
    """Group the scored fields into holds / caution / breaks and list exclusions."""

    ordered = sorted(fields, key=lambda field: field["similarity"])
    breaks = [field for field in ordered if field["similarity"] < BREAK_THRESHOLD]
    caution = [
        field for field in ordered
        if BREAK_THRESHOLD <= field["similarity"] < CAUTION_THRESHOLD
    ]
    holds = [field for field in ordered if field["similarity"] >= CAUTION_THRESHOLD]

    excluded = list(not_scored) + [
        {"parameter": parameter, "kind": "reference only", "reason": reason}
        for parameter, reason in REFERENCE_ONLY.get(body, ())
    ]

    scored = len(fields)

    def names(items, limit=3):
        listed = ", ".join(field["parameter"] for field in items[:limit])
        if len(items) > limit:
            listed += f" and {len(items) - limit} more"
        return listed

    if not scored:
        summary = "No field in this model could be compared for this site."
    elif breaks:
        summary = (
            f"Breaks on {len(breaks)} of {scored} scored fields ({names(breaks)}); "
            f"{len(holds)} hold and {len(caution)} need caution."
        )
    else:
        summary = (
            f"No scored field falls below the break threshold; {len(holds)} of "
            f"{scored} hold and {len(caution)} need caution."
        )

    if excluded:
        summary += f" {len(excluded)} field(s) cannot be scored at all."

    return {
        "fields": ordered,
        "breaks": breaks,
        "caution": caution,
        "holds": holds,
        "not_scored": excluded,
        "summary": summary,
        "thresholds": {
            "breaks_below": BREAK_THRESHOLD,
            "caution_below": CAUTION_THRESHOLD,
        },
        "scored_fields": scored,
        "model_fields": int(round(possible_weight)),
        "weighted_coverage": round(available_weight, 3),
    }


def rank_earth_analogues(
    body,
    quadrangle_row,
    earth_sheets,
    top_n=3
):

    body = body.strip().lower()

    if body not in {"mars", "moon"}:
        raise ValueError(
            "Body must be Mars or Moon."
        )

    if body == "mars":
        target = _mars_target(quadrangle_row)
    else:
        target = _moon_target(quadrangle_row)

    definitions = _feature_definitions(body)

    coords = earth_sheets.get("COORDINATES")

    if coords is None or "Place name" not in coords.columns:
        raise ValueError(
            "The Earth workbook is missing its COORDINATES worksheet."
        )

    sites = coords.iloc[EARTH_ROW_START:].dropna(
        subset=["Place name"]
    )

    records = []
    details = []

    earth_cache = {

        str(site["Place name"]).strip():
        _earth_features(
            body,
            earth_sheets,
            str(site["Place name"]).strip()
        )

        for _, site in sites.iterrows()
    }

    feature_values = {

        key: [
            _num(values.get(key))
            for values in earth_cache.values()
        ]

        for key, _, _ in definitions
    }


    for _, site in sites.iterrows():

        place = str(
            site["Place name"]
        ).strip()

        earth = earth_cache[place]

        weighted_score = 0.0
        available_weight = 0.0

        possible_weight = sum(
            weight
            for _, _, weight in definitions
        )

        matches = []
        fields = []
        not_scored = []


        for key, label, weight in definitions:

            target_value = _num(
                target.get(key)
            )

            earth_value = _num(
                earth.get(key)
            )

            if target_value is None or earth_value is None:
                not_scored.append({
                    "parameter": label,
                    "kind": "no data",
                    "reason": _missing_reason(target_value, earth_value),
                })
                continue


            # Normalize difference using the observed
            # spread among the available Earth sites.
            vals = [
                value
                for value in feature_values[key]
                if value is not None
            ]

            spread = (
                max(vals) - min(vals)
                if len(vals) > 1
                else 0.0
            )

            scale = max(
                spread,
                abs(target_value) * 0.25,
                1.0
            )


            similarity = max(
                0.0,
                1.0 - abs(
                    target_value - earth_value
                ) / scale
            ) * 100.0


            weighted_score += similarity * weight
            available_weight += weight

            fields.append({
                "parameter": label,
                "similarity": round(similarity, 1),
                "target": target_value,
                "earth": earth_value,
                "caveat": PARAMETER_CAVEATS.get(label, ""),
            })

            matches.append(
                (
                    label,
                    similarity,
                    target_value,
                    earth_value
                )
            )


        if available_weight == 0:
            continue


        coverage = (
            100.0 * available_weight / possible_weight
        )

        final_score = (
            weighted_score / available_weight
        )


        assessment = _assess(
            body,
            fields,
            not_scored,
            possible_weight,
            available_weight
        )

        records.append({

            "Earth analogue": place,

            "Terrain type": site.get(
                "Terrain type"
            ),

            "Country / region": site.get(
                "Country and region"
            ),

            "Similarity (%)": round(
                final_score, 1
            ),

            "Data coverage (%)": round(
                coverage, 1
            ),

            "assessment": assessment,
        })


        for label, score, target_value, earth_value in matches:

            details.append({

                "Earth analogue": place,

                "Parameter": label,

                "Similarity (%)": round(
                    score, 1
                ),

                "Target value": target_value,

                "Earth value": earth_value,
            })


    ranked = pd.DataFrame(records)

    if ranked.empty:

        return (
            ranked,
            pd.DataFrame(
                columns=[
                    "Earth analogue",
                    "Parameter",
                    "Similarity (%)",
                    "Target value",
                    "Earth value"
                ]
            )
        )


    ranked = ranked.sort_values(

        ["Similarity (%)", "Data coverage (%)"],

        ascending=False

    ).head(top_n).reset_index(drop=True)


    ranked.insert(
        0,
        "Rank",
        range(1, len(ranked) + 1)
    )


    details_df = pd.DataFrame(details)

    details_df = details_df[
        details_df["Earth analogue"].isin(
            ranked["Earth analogue"]
        )
    ]

    details_df = details_df.sort_values(
        ["Earth analogue", "Similarity (%)"],
        ascending=[True, False]
    )


    return ranked, details_df

"""Coordinate helpers for single points and rectangular coordinate ranges."""

def normalize_longitude_360(longitude: float) -> float:
    """Convert longitude to the 0..360 east-positive convention."""
    return float(longitude) % 360.0


def midpoint_latitude(lat_min: float, lat_max: float) -> float:
    """Arithmetic midpoint of the latitude limits."""
    if lat_min > lat_max:
        raise ValueError("Minimum latitude must be less than or equal to maximum latitude.")
    if not (-90 <= lat_min <= 90 and -90 <= lat_max <= 90):
        raise ValueError("Latitude must be between -90° and 90°.")
    return (float(lat_min) + float(lat_max)) / 2.0


def midpoint_longitude(lon_start: float, lon_end: float) -> float:
    """
    Midpoint along the shorter eastward/westward arc.
    Handles ranges crossing the -180/180 (or 0/360) boundary.
    The result uses 0..360 east longitude.
    """
    start = normalize_longitude_360(lon_start)
    end = normalize_longitude_360(lon_end)
    eastward_span = (end - start) % 360.0
    if eastward_span <= 180.0:
        midpoint = start + eastward_span / 2.0
    else:
        midpoint = end + (360.0 - eastward_span) / 2.0
    return midpoint % 360.0


def process_coordinates(
    latitude: float | None = None,
    longitude: float | None = None,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lon_start: float | None = None,
    lon_end: float | None = None,
) -> tuple[float, float, str]:
    """Return (latitude, east longitude 0..360, explanation)."""
    is_range = any(v is not None for v in (lat_min, lat_max, lon_start, lon_end))

    if is_range:
        if None in (lat_min, lat_max, lon_start, lon_end):
            raise ValueError("For a coordinate range, enter all four limits: minimum/maximum latitude and start/end longitude.")
        lat = midpoint_latitude(lat_min, lat_max)
        lon = midpoint_longitude(lon_start, lon_end)
        return lat, lon, "Midpoint calculated from the supplied coordinate range (FMP)."

    if latitude is None or longitude is None:
        raise ValueError("Enter either one latitude/longitude point or all four coordinate-range limits.")
    if not -90 <= float(latitude) <= 90:
        raise ValueError("Latitude must be between -90° and 90°.")
    return float(latitude), normalize_longitude_360(float(longitude)), "Single coordinate used directly."

"""Find the Mars or Moon quadrangle containing a coordinate."""

def longitude_is_inside(longitude_360: float, west_or_min: float, east_or_max: float) -> bool:
    """Check a longitude against a 0..360 interval, including wraparound."""
    lon = float(longitude_360) % 360.0
    start = float(west_or_min) % 360.0
    end = float(east_or_max) % 360.0

    # A 0..360 interval means all longitudes.
    if abs(float(east_or_max) - float(west_or_min)) >= 359.999:
        return True

    if start <= end:
        return start <= lon <= end
    return lon >= start or lon <= end


def find_quadrangle(body: str, latitude: float, longitude_360: float, mars_df, moon_df):
    """Return the matching quadrangle row, or None if no row contains the point."""
    body = body.strip().lower()

    if body == "mars":
        df = mars_df
        for _, row in df.iterrows():
            lat_min, lat_max = float(row["lat_min"]), float(row["lat_max"])
            if lat_min <= latitude <= lat_max and longitude_is_inside(
                longitude_360, row["lon_min"], row["lon_max"]
            ):
                return row
    elif body == "moon":
        df = moon_df
        for _, row in df.iterrows():
            lat_min, lat_max = float(row["lat_min"]), float(row["lat_max"])
            if lat_min <= latitude <= lat_max and longitude_is_inside(
                longitude_360, row["lon_west"], row["lon_east"]
            ):
                return row
    else:
        raise ValueError("Body must be 'Mars' or 'Moon'.")

    return None


"""Load the three supplied Excel workbooks."""

from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"


def load_mars():
    raw = pd.read_excel(
        DATA_DIR / "mars_data.xlsx",
        sheet_name="Quadrangles",
        header=4
    )

    df = pd.DataFrame({
        "quadrangle": raw["Quad"],
        "name": raw["Name"],
        "lat_min": pd.to_numeric(raw.iloc[:, 4], errors="coerce"),
        "lat_max": pd.to_numeric(raw.iloc[:, 5], errors="coerce"),
        "lon_min": pd.to_numeric(raw.iloc[:, 7], errors="coerce"),
        "lon_max": pd.to_numeric(raw.iloc[:, 8], errors="coerce"),
    })

    df = df.dropna(
        subset=["quadrangle", "lat_min", "lat_max", "lon_min", "lon_max"]
    )

    df["quadrangle"] = df["quadrangle"].astype(str)

    return df.reset_index(drop=True), raw


def load_moon():
    raw = pd.read_excel(
        DATA_DIR / "moon_data.xlsx",
        sheet_name="Actual Data"
    )

    df = pd.DataFrame({
        "quadrangle": raw["Quadrangle"],
        "lat_min": pd.to_numeric(raw["min latitude (°)"], errors="coerce"),
        "lat_max": pd.to_numeric(raw["max latitude (°)"], errors="coerce"),
        "lon_west": pd.to_numeric(raw["West longitude E (°)"], errors="coerce"),
        "lon_east": pd.to_numeric(raw["East longitude E (°)"], errors="coerce"),
    })

    df = df.dropna(
        subset=["quadrangle", "lat_min", "lat_max", "lon_west", "lon_east"]
    )

    df["quadrangle"] = df["quadrangle"].astype(str)

    return df.reset_index(drop=True), raw


def load_earth():
    return pd.read_excel(
        DATA_DIR / "earth_data.xlsx",
        sheet_name=None
    )


def load_all_data():
    mars_index, mars_raw = load_mars()
    moon_index, moon_raw = load_moon()
    earth_sheets = load_earth()

    return {
        "mars_index": mars_index,
        "mars_raw": mars_raw,
        "moon_index": moon_index,
        "moon_raw": moon_raw,
        "earth_sheets": earth_sheets,
    }


from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
import math

import pandas as pd



app = FastAPI(title="Mars Moon Analogue API")

# Allow your website to communicate with the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your website domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the Excel datasets once when the server starts.
data = load_all_data()


class AnalogueRequest(BaseModel):
    body: str

    latitude: float | None = None
    longitude: float | None = None

    lat_min: float | None = None
    lat_max: float | None = None
    lon_start: float | None = None
    lon_end: float | None = None

    top_n: int = Field(default=5, ge=1, le=10)


def _coordinate(value):
    """Return a finite float or None for a workbook coordinate cell."""
    try:
        number = pd.to_numeric(value, errors="coerce")
    except (TypeError, ValueError):
        return None

    if pd.isna(number):
        return None

    number = float(number)
    return number if math.isfinite(number) else None


def earth_coordinates():
    """Map each Earth workbook site to its recorded central latitude/longitude."""
    coords = data["earth_sheets"].get("COORDINATES")

    if coords is None or "Place name" not in coords.columns:
        return {}

    lookup = {}

    for _, row in coords.iterrows():
        place = row.get("Place name")

        if not isinstance(place, str) or not place.strip():
            continue

        latitude = _coordinate(row.get("central lattitude"))
        longitude = _coordinate(row.get("central longitude"))

        if latitude is None or longitude is None:
            continue

        lookup[place.strip()] = {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
        }

    return lookup


@app.get("/api/health")
def health():
    return {"status": "running"}


MODIS_ORNL_URL = "https://modis.ornl.gov/rst/api/v1/MOD11A2/subset"
MODIS_BANDS = {"LST_Day_1km", "LST_Night_1km"}
MODIS_WINDOWS = {"A2025001:A2025073", "A2025177:A2025249"}


@lru_cache(maxsize=256)
def _request_modis(latitude: str, longitude: str, band: str, window: str):
    start_date, end_date = window.split(":")
    query = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "band": band,
        "startDate": start_date,
        "endDate": end_date,
        "kmAboveBelow": "3",
        "kmLeftRight": "3",
    })
    request = Request(
        f"{MODIS_ORNL_URL}?{query}",
        headers={"Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=90) as response:
            payload = json.loads(response.read())
    except HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"ORNL MODIS service returned HTTP {error.code}.",
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail="ORNL MODIS service is unavailable.",
        ) from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="ORNL MODIS service returned invalid JSON.",
        ) from error
    if not isinstance(payload, dict) or not isinstance(payload.get("subset"), list):
        raise HTTPException(
            status_code=502,
            detail="ORNL MODIS response has an invalid subset.",
        )
    return payload


@app.get("/api/modis")
def get_modis(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    band: str = Query(...),
    window: str = Query(...),
):
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or band not in MODIS_BANDS
        or window not in MODIS_WINDOWS
    ):
        raise HTTPException(status_code=400, detail="Invalid MODIS query parameters.")
    return _request_modis(f"{latitude:.4f}", f"{longitude:.4f}", band, window)


@app.post("/api/analogs")
def find_analogs(request: AnalogueRequest):

    try:
        body = request.body.strip().capitalize()

        if body not in ["Mars", "Moon"]:
            raise ValueError("Body must be Mars or Moon.")

        # 1. Process coordinates
        lat, lon, method = process_coordinates(
            latitude=request.latitude,
            longitude=request.longitude,
            lat_min=request.lat_min,
            lat_max=request.lat_max,
            lon_start=request.lon_start,
            lon_end=request.lon_end
        )

        # 2. Find planetary quadrangle
        match = find_quadrangle(
            body,
            lat,
            lon,
            data["mars_index"],
            data["moon_index"]
        )

        if match is None:
            raise HTTPException(
                status_code=404,
                detail="No quadrangle found for these coordinates."
            )

        # 3. Retrieve original planetary data
        if body == "Mars":
            raw_df = data["mars_raw"]
            id_col = "Quad"
        else:
            raw_df = data["moon_raw"]
            id_col = "Quadrangle"

        rows = raw_df[
            raw_df[id_col].astype(str)
            == str(match["quadrangle"])
        ]

        if rows.empty:
            raise ValueError("Quadrangle data not found.")

        quadrangle_row = rows.iloc[0]

        # 4. Calculate Earth analogue similarities
        ranked, details = rank_earth_analogues(
            body,
            quadrangle_row,
            data["earth_sheets"],
            top_n=request.top_n
        )

        # 5. Convert Pandas dataframes into JSON-compatible records
        ranked_json = json.loads(
            ranked.to_json(orient="records")
        )

        details_json = json.loads(
            details.to_json(orient="records")
        )

        # 6. Attach the recorded Earth coordinates so the browser can place
        #    every analogue on the globe.
        earth_points = earth_coordinates()

        for record in ranked_json:
            point = earth_points.get(str(record.get("Earth analogue")).strip())
            record["latitude"] = point["latitude"] if point else None
            record["longitude"] = point["longitude"] if point else None
            record["coordinates_available"] = point is not None

        return {
            "body": body,
            "coordinates": {
                "latitude": lat,
                "longitude": lon,
                "method": method
            },
            "quadrangle": str(match["quadrangle"]),
            "quadrangle_name": str(match["name"])
                if body == "Mars" else str(match["quadrangle"]),
            "quadrangle_bounds": {
                "lat_min": float(match["lat_min"]),
                "lat_max": float(match["lat_max"]),
                "lon_min": float(match["lon_min"])
                    if body == "Mars" else float(match["lon_west"]),
                "lon_max": float(match["lon_max"])
                    if body == "Mars" else float(match["lon_east"]),
            },
            "analogues": ranked_json,
            "parameter_details": details_json
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )
