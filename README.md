# Otherworld Atlas

**Live demo:** <https://hackathon1-private.vercel.app> · **Source:** <https://github.com/chetanys/Astronautical-analog-finder>

Otherworld Atlas is a browser-based planetary analog screening prototype. It
searches a bundled Earth land grid locally, ranks the closest cells for
user-selected environmental targets, and presents the result as regional
context. It is not a site certification, rover safety assessment, or mission
planning tool.

## What the app currently measures

The checked-in browser grid currently scans **575,482 source-covered land
cells** on an approximately **15 km equal-area grid**. Its temperature,
elevation, slope and aridity sources are recorded in
`assets/earth_grid.json`; the checked-in grid currently uses TerraClimate
2025 and WorldClim 2.1. The NASA extraction path below produces a replacement
grid, but it does not become active until you export the layers and rebuild
the binary.

The NASA path uses NASADEM v001 elevation and MODIS MOD11A2 v061 clear-QA
surface temperatures for complete calendar years 2015–2025. Temperature is
the midpoint of the annual mean day and night LST values, not air temperature.
NASADEM is not polar-global: its elevation/slope only replace the fallback
where its valid land coverage exists. MODIS clear-sky gaps likewise retain
the TerraClimate air-temperature fallback. The generated grid metadata
records NASA coverage counts and these mixed-source definitions. Aridity
remains the TerraClimate-derived proxy
`10 × clamp(1 − annual precipitation / annual PET, 0, 1)`.

The Moon mode still sets context only: lunar rasters and authoritative
Artemis-region geometries are not integrated. The supplied Mars spreadsheet
and MOLA values are reference data, not equivalent Earth measurements.

The score is a weighted mean of absolute differences divided by each field's
observed 5th-to-95th percentile spread. Its display value is
`100 / (1 + normalized distance)`. This is a relative screening score, not a
probability, calibrated scientific model, or rover risk score. Temperature,
elevation, slope and aridity are the only scored fields; other spreadsheet
parameters have no corresponding global Earth measurements.

## Live NASA POWER and MODIS context

Selecting a ranked Earth grid cell requests its climatology from the public
NASA POWER point API. The browser requests `T2M`, `T2M_MAX`, `T2M_MIN` and
`PRECTOTCORR`; the displayed values are live API responses, while the
climatology itself covers January 2001 through December 2025. Temperature is
in °C and corrected precipitation is in mm/day. A failed request is shown as
unavailable and can be retried; no placeholder climate values are displayed.
The top ten scan rows are enriched with the same API in batches of three.
These POWER lookups do not alter the bundled-grid score.

MODIS is a separate live contextual sample from the ORNL DAAC MODIS/VIIRS
subsets service, product `MOD11A2`. Direct browser requests are blocked by
CORS, so the app calls the same-origin Vercel function `api/modis.js`. On cell
selection, it requests day and night bands for two 2023 windows (DOY 001–073
and 177–249), each with a 3 km sample box. This is not a full-year climatology
or a 15 km tile mean. The UI labels it a point-area sample and explicitly says
it does not alter the grid ranking. The **Load MODIS for top 10** button makes
the four requests per cell sequentially and only when clicked.

MODIS sampling is implemented but depends on ORNL DAAC availability; the
service returned HTTP 503 during the latest endpoint test, so live MODIS
values were not verified at submission time. In that case the app shows an
unavailable state and offers a retry, without substituting values. The proxy
accepts only the two configured date windows and day/night LST bands, validates
coordinates, and caches successful upstream responses for one day.

For an offline AppEEARS fallback, download the top-ten coordinate file with
**Export top 10 sites JSON**, then run:

```sh
python3 scripts/appeears_sites.py sites.json
```

The script prompts for Earthdata credentials without echoing or saving the
password, requests MOD11A2 v061 day/night LST and paired QC layers for 2020–2024,
and writes `assets/modis_cache.json` only after verifying downloaded file
checksums and parsing good-QA observations. The live app does not read this
cache. The fallback uses MOD11A2 mandatory QA bits 0–1 equal to zero and
reports day/night land-surface temperature, not air temperature. Do not place
credentials in browser code or commit them.

The analog page returns the top 20 grid cells for the last search. They are
data-ranked candidate cells, not 20 independently verified, named analog
sites. The shared Earth and Moon spreadsheets provide parameter definitions,
not measured site catalogs. The rover review reports which grid fields are
available and their proxy similarity where applicable. It does not assign
failure probabilities or infer coverage for unmeasured engineering factors.

## Run locally

Serve the repository over HTTP; browser workers and `fetch()` do not work
reliably from a `file://` URL. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. Keep `assets/earth_grid.bin` and
`assets/earth_grid.json` together; the JSON includes field units, scoring
scales, spatial coverage and citations.

## Verify NASA data access through the AppEEARS API

The public AppEEARS product catalog confirms `MOD11A2.061` with
`LST_Day_1km`, `LST_Night_1km`, `QC_Day` and `QC_Night`, and `NASADEM_NC.001`
with `NASADEM_HGT` in metres. Verify the catalog without credentials:

```sh
python -m scripts.appeears_access_test --catalog-only
```

Run a small authenticated extraction for one point at Mauna Kea:

```sh
python -m scripts.appeears_access_test
```

The script prompts for the NASA Earthdata Login username and a hidden password;
it does not save credentials. It submits a one-point MODIS task for 2020,
requests both LST layers and their QC layers, polls the task, downloads the
CSV bundle to `data/appeears/`, and verifies each file's SHA-256 checksum.
Use `--site "Haughton impact crater"` to select another exact name from
`assets/known_sites.csv`, `--year 2024` to test a different year, or
`--task-id TASK_ID` to resume polling/downloading an existing task.

MOD11A2 is an 8-day clear-sky land-surface-temperature composite, not air
temperature. Use the paired QC layers and mask samples unless mandatory QA
bits 0–1 equal 0; convert valid LST values with `Kelvin = DN × 0.02`, then
`Celsius = Kelvin − 273.15`. A point extraction proves access and provides
actual sample values, but does not activate or validate the browser's
575,482-cell global grid. AppEEARS is not a one-call global 8-day raster
export, and NASADEM point elevations alone cannot establish a 100 m-baseline
slope. The checked-in grid remains TerraClimate/WorldClim until a separate,
validated global build replaces it.

## Optional full-grid Earth Engine raster export

The NASA layers are prepared in Google Earth Engine and exported to Google
Drive as one GeoTIFF aligned to the app's 15 km grid:

1. Register the Cloud project for Earth Engine at
   <https://console.cloud.google.com/earth-engine>. Earth Engine requires a
   registered project; select commercial registration if this project will
   be used commercially.
2. Open <https://code.earthengine.google.com/> and select Cloud project
   `nasa-project-514803` in the project selector.
3. Open `scripts/export_nasa_earth_layers.js` in the Code Editor, run it, then
   start its export task in the **Tasks** panel. The finished
   `nasa_earth_layers_2015_2025.tif` appears in the `OtherworldAtlas` folder
   in Google Drive. Download it to `data/earth_engine/`.

The export uses only MODIS pixels whose QA mandatory bits 0–1 indicate good
quality. It converts each stored MOD11A2 LST value with
`Kelvin = DN × 0.02`, then `Celsius = Kelvin − 273.15`; day/night midpoint is
`(mean day LST + mean night LST) / 2`. MOD11A2 is an 8-day clear-sky land
surface-temperature composite; its value is not a continuous all-weather air
temperature. NASADEM elevation is referenced to the EGM96 geoid. Its slope
layer is Horn terrain slope calculated from the DEM aggregated to a 100 m
baseline, then averaged into the 15 km cell. It is a regional terrain metric,
not rover-scale traversability.

Install the grid dependencies and prepare the TerraClimate/WorldClim fallback
rasters:

```sh
pip install -r requirements-grid.txt
python -m scripts.prepare_terraclimate --year 2025
```

Build the binary and metadata with:

```sh
python -m scripts.build_grid \
  --temperature data/processed/temperature_2025.tif \
  --elevation data/processed/worldclim/wc2.1_2.5m_elev.tif \
  --precipitation data/processed/precipitation_2025.tif \
  --pet data/processed/pet_2025.tif \
  --nasa-grid data/earth_engine/nasa_earth_layers_2015_2025.tif \
  --period "MODIS MOD11A2 v061 clear-QA day/night LST, 2015-2025; TerraClimate 2025 fallback" \
  --citation "NASA/USGS/JPL NASADEM Merged DEM Global 1 arc-second V001, DOI:10.5067/MEaSUREs/NASADEM/NASADEM_HGT.001" \
  --citation "NASA LP DAAC MODIS MOD11A2 V061, DOI:10.5067/MODIS/MOD11A2.061; 2015-2025 day/night LST, clear mandatory QA only" \
  --citation "TerraClimate (2025), monthly climate fields, CC0; Abatzoglou et al. (2018), doi:10.1038/sdata.2017.191" \
  --citation "WorldClim 2.1 elevation fallback (2.5 arc-minute); Fick and Hijmans (2017), https://www.worldclim.org/data/worldclim21.html"
```

If you omit `--nasa-grid`, the build remains the current TerraClimate /
WorldClim-only grid. After rebuilding, inspect `assets/earth_grid.json`:
`nasaLayerCoverage` reports how many land cells actually used NASA layers,
and the temperature/elevation definitions describe the fallback behavior.
Commit or deploy the rebuilt `earth_grid.bin` and `earth_grid.json` together.

## Validation and source data

`assets/known_sites.csv` contains approximate coordinates and source links for
11 named reference areas. Generate the validation report with:

```sh
node scripts/validate_known_sites.js
```

The script selects the nearest source-covered tile, reports the percentile
for one expected feature per site, and requires the tile center to be within
one 15 km cell width of the approximate coordinate. It also runs ±20%
one-at-a-time weight sensitivity checks against the default top 20. These are
limited sanity checks—not independent validation of the dataset or ranking.
The report is `assets/known_sites_validation.json`; feature-threshold misses
and locations too far from a source-covered tile remain reported as failures.

The Mars reference bundle is built from the project-supplied spreadsheet and
public MOLA source data:

```sh
python -m scripts.prepare_mars_reference
```

The supplied Mars values have not been independently validated. MOLA's coarse
source spacing differs from the Earth grid, so its slope is reference-only and
is not copied into a scored target.

The rover visualization is now project-authored procedural Three.js geometry,
not the unverified bundled rover mesh. It is an illustrative six-wheel rover,
not a Perseverance replica or flight-compatible model. Three.js v0.170.0 is
loaded from <https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js>
under the MIT license (<https://github.com/mrdoob/three.js/blob/dev/LICENSE>).
If the library or WebGL renderer is unavailable, the page displays the
included project-authored SVG schematic instead. NASA Perseverance component
facts shown in the separate engineering reference panel are linked to NASA's
mission page and are not measurements of the illustration.

## Limits and reuse

The rover panel is a screening aid. Regional slope and surface/air temperature do not
measure wheel traction, obstacle geometry, thermal extremes, radiation,
illumination, communications, dust behavior, hardware limits or failure
probability. Use dedicated, mission-specific data and laboratory/field tests
before engineering decisions.

Before commercial deployment, confirm the applicable redistribution,
attribution and commercial-use terms for every dataset and visual asset.
NASA data are generally openly usable subject to NASA's data policy and
product citation requirements; confirm each product's current terms. Earth
Engine itself requires the project to be registered for the intended use.
TerraClimate is CC0; WorldClim attribution is required and its applicable
commercial terms should be confirmed. The app is not represented as a
commercial-ready or safety-qualified product.
