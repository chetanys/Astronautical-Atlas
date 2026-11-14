# Hackathon1

Otherworld Atlas compares Earth locations in Moon and Mars modes. Site profiles
also load NASA POWER long-term climatology for mean temperature, wind speed and
surface solar radiation at each location, including monthly mean temperature.
Choose a location from the map's
“Open a site” menu or click its globe marker to view the profile and climate
readings. Site profiles can be opened with a `?site=` URL parameter and
exported as JSON. The sidebar's no-API sunlight calculator estimates maximum
winter-solstice Sun elevation at local noon from latitude, using Mars's axial
tilt in Mars mode. Low-light winter analog
sites (10° or less) are highlighted on the globe; this is illumination context,
not a rover failure probability. The calculator also visualizes the shadow of a
1 m rover using `shadow length = 1 m / tan(sun elevation)`. At or below the
horizon it reports night instead of inventing a shadow length.

The model's checkpoint files are not included here: the Hugging Face repository
is approximately 12.8 GB. The Lunar AI Lab source and its official hosted-demo
embed remain in the project but are hidden from the website for now. See the
[model card](https://huggingface.co/nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model)
and [live demo](https://huggingface.co/spaces/nasa-ibm-ai4science/nasa-ibm-lunar-foundation-model-generation-demo)
for model details and usage. Generated outputs are qualitative research probes,
not calibrated science or mission-planning data.

The planetary analog map uses NASA's interactive 3D Earth model, with the
existing location markers, filters and site profiles overlaid on the globe.
The model is stored in `assets/earth.glb` so it can load from local development
servers such as VS Code Live Server, which cannot fetch NASA's CORS-restricted
model endpoint. NASA POWER climatology is requested from its public API when a
site profile is opened; those readings supplement the illustrative profile
and do not currently affect match scores. The API's grid-cell averages may
differ from local conditions, particularly in high-relief terrain.

## Global grid search

The global-grid search is separate from the illustrative named-site filters.
It stores one six-Float32 record per valid land tile: latitude, longitude,
temperature, elevation, slope, and aridity. Tiles are approximately 15 km in
an equal-area EPSG:6933 grid; ocean and no-data cells are omitted. The 2025 build contains 575,482
source-covered land tiles; the count is generated into `assets/earth_grid.json`,
not assumed to be exactly 600,000. The input overlap currently covers latitudes
about 82.3°S to 82.3°N; high-latitude land without WorldClim elevation is not
included, so this is not yet a complete all-land global coverage product. The browser worker scans the bundled records locally
and returns the ten best candidates.

The four search features are mean annual temperature, elevation above sea
level, regional slope, and an aridity index. Aridity is
`10 × clamp(1 − annual precipitation / annual PET, 0, 1)`; higher values mean
drier conditions. Regridding and slope are regional screening estimates, not
rover-scale measurements, safety certifications, or mission recommendations.
The score is a normalized distance to user-entered values, not a probability.
Users set each feature's weight from 0 (excluded) to 5; active absolute
differences are divided by that field's 5th-to-95th percentile spread and
combined as a weighted mean distance. The displayed similarity is
`100 / (1 + weighted distance)`, so candidates remain ranked even when all
targets are far outside Earth's observed range. This normalization is
data-dependent and has not been calibrated against expert analog rankings or
rover outcomes.

### Build the Earth land grid

The preparation script downloads TerraClimate monthly NetCDF files plus
WorldClim elevation and writes annualized rasters under ignored `data/`.
The newest complete annual TerraClimate files found in the direct archive on
2026-11-14 were 2025. The Earth Engine catalog metadata currently lists its
TerraClimate collection through 2024, so the 2025 direct-archive files are
identified as a later archive snapshot and are validated locally before use.
They are not a near-real-time feed or a climate normal.

```sh
pip install -r requirements-grid.txt
python -m scripts.prepare_terraclimate --year 2025
```

The yearly means/sums are written as `temperature_2025.tif`,
`precipitation_2025.tif`, and `pet_2025.tif`; elevation is static:

```sh
python -m scripts.build_grid \
  --temperature data/processed/temperature_2025.tif \
  --elevation data/processed/worldclim/wc2.1_2.5m_elev.tif \
  --precipitation data/processed/precipitation_2025.tif \
  --pet data/processed/pet_2025.tif \
  --period "2025 calendar year" \
  --citation "TerraClimate (2025), monthly tmin/tmax/ppt/pet, CC0; Abatzoglou et al. (2018), doi:10.1038/sdata.2017.191" \
  --citation "WorldClim 2.1 elevation (2.5 arc-minute), Fick and Hijmans (2017), https://www.worldclim.org/data/worldclim21.html"
```

The input download is about 450 MB and is cached under `data/raw/`; raw and
intermediate rasters are excluded from Git. Keep the generated grid binary
and metadata together for local or static hosting. `assets/earth_grid.json`
records the schema, source period, units, formulas, projection, land mask,
and citations.

### Mars data and cross-planet limits

The current public global terrain source identified for Mars is the
[MGS MOLA MEGDR PDS4 bundle](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html).
Its 4-pixel-per-degree product represents topography from MOLA observations
made during 1997–2001. The PDS4 bundle was migrated/updated in 2026; that is
not a new global surface survey. Mars topography is relative to a Mars areoid,
so absolute Mars and Earth elevation values are not interchangeable. Earth
temperature, pressure, radiation, dust, and regolith do not reproduce the
Martian environment; they must not be described as equivalent.

The shared spreadsheets include a 30-region Mars table and separate parameter
dictionaries. The app preserves all supplied Mars row values and provides an
optional region selector that copies the supplied temperature and elevation,
plus MOLA-derived coarse slope, into numeric search targets. These raw
cross-planet comparisons are not physical equivalences. Mars pressure,
geology, dust, radiation, and all fields without a comparable Earth-grid layer
remain reference-only and are excluded from the score. The sheets are
project-provided reference material, not independently validated planetary
measurements or a substitute for MOLA/PDS source products. Fields with no
traceable observation, method, unit, period, and reuse rights must remain
unscored.

The source spreadsheets are preserved under `assets/source-data/`. Regenerate
the app-ready Mars reference JSON (and refresh the small MOLA source image from
PDS) with:

```sh
python -m scripts.prepare_mars_reference
```

The script validates the MOLA label's 720 × 1,440 shape and big-endian
integer encoding before deriving center-pixel/latitude-band slope estimates.
The source spreadsheet values remain intact alongside those derived fields;
they are not silently substituted for the PDS measurements.

Before commercial deployment, verify the redistribution rights of every
source dataset and supplied 3D model, publish required attribution, and
validate the grid and ranking against independent field/engineering data.
This project is a research-screening prototype, not a flight, safety, or
qualification tool.

Serve the page over HTTP (for example with VS Code Live Server) rather than
opening `index.html` as a `file://` URL. Browser workers and fetches require a
local or hosted web origin.

## Site pages and rover prototype

The static site includes Home, Services, Guide, Analogs, Application, Rover
Prototype, and Team pages. The analog catalog currently contains 12 starter
references with illustrative profile values; it is not a vetted ranking.
The rover page loads `assets/perseverance.glb` in the browser and lets users
inspect a selected grid-search candidate against the available terrain or
climate fields. Camera drag, orbit buttons and auto-spin control the model.
The Rover Risk Management panel ranks the best overall grid match and lets
users select another scan result for a specific analog review. It separates
available environmental screening inputs from hardware and engineering
factors that the grid cannot test. This is not ML; subsystem fit bars are
screening illustrations, not qualification results or failure probabilities.
No rover hardware tests are performed by the application. The prototype does
not connect to rover hardware or flight software, and it does not yet provide
image-based analog matching.

The GLB was exported from the assembled Blender scene supplied for this
project. To rebuild it, use Blender with its glTF 2.0 exporter enabled:

```sh
blender -b "/path/to/source.blend" \
  --python scripts/export_rover.py -- \
  --output assets/perseverance.glb
```

The exporter packs available textures and warns when it must substitute a
neutral fallback for a missing texture. Confirm the original model's
attribution and redistribution terms before republishing the model. The rover
is a visual reference only; the export does not imply compatibility with a
real rover or its software.

The deployed browser search makes no data API calls. NASA POWER is suitable
for point/site climatology, not millions of per-cell requests; NASA GIBS is
for imagery layers, and AWS Terrain Tiles can provide elevation imagery or
tiles for inspection. Neither should be queried for every grid cell at
runtime. Download or prepare appropriately licensed global rasters locally,
then install the requirements:

```sh
pip install -r requirements-grid.txt
```

Run the builder with your local raster paths; repeat `--citation` for each
source, and set scale options where a source stores scaled integer values:

```sh
python -m scripts.build_grid \
  --temperature /data/mean-temperature.tif \
  --elevation /data/elevation.tif \
  --precipitation /data/annual-precipitation.tif \
  --pet /data/annual-pet.tif \
  --citation "Dataset name, version, period, license, URL"
```

Keep both `assets/earth_grid.bin` and `assets/earth_grid.json` when deploying
the site. Their citations are shown beside the global-grid search results. The
raster files themselves are only needed for rebuilding the grid.