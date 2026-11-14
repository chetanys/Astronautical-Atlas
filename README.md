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
Build `assets/earth_grid.bin` once using `python -m scripts.build_grid`. It stores four
Float32 values per 0.25-degree cell (temperature, elevation, slope, and
aridity) for a 720 × 1,440 grid. The browser worker scans the grid locally and
returns the ten best matches; ocean and no-data cells are skipped. The globe
starts without preset analog markers and places only locations returned by the
user's scan. The named reference catalog remains optional and separate.

The local Python builder accepts GeoTIFF rasters or GDAL NetCDF subdatasets
for mean temperature, elevation, annual precipitation, and annual potential
evapotranspiration. It reprojects them to a common 0.25-degree grid, derives
slope from elevation, and computes a dryness score as
`10 × clamp(1 − annual precipitation / annual PET, 0, 1)`; higher values mean
drier conditions. Source raster units, scale factors, resolution, and masks
must be checked before processing. Regridding and derived slope are estimates,
not validated site measurements. Use `--citation` to record each data source
in the generated `assets/earth_grid.json` sidecar.

### Download a starter dataset

The project includes a downloader/preparation script for public inputs. It
downloads one year's TerraClimate monthly NetCDF files and WorldClim elevation,
then writes annualized GeoTIFF inputs under the ignored `data/` directory:

```sh
pip install -r requirements-grid.txt
python -m scripts.prepare_terraclimate --year 1991
```

Build the browser grid from those prepared inputs:

```sh
python -m scripts.build_grid \
  --temperature data/processed/temperature_1991.tif \
  --elevation data/processed/worldclim/wc2.1_2.5m_elev.tif \
  --precipitation data/processed/precipitation_1991.tif \
  --pet data/processed/pet_1991.tif \
  --citation "TerraClimate (1991), monthly tmin/tmax/ppt/pet, CC0; Abatzoglou et al. (2018), doi:10.1038/sdata.2017.191" \
  --citation "WorldClim 2.1 elevation (2.5 arc-minute), Fick and Hijmans (2017), https://www.worldclim.org/data/worldclim21.html"
```

The default 1991 build is a functional starter snapshot, **not** a
climatological normal or a validated planetary-analog product. The
preparation script caches raw downloads under `data/raw/`; raw and
intermediate rasters are excluded from Git. The generated grid binary and
metadata are deployment assets and should be retained in the project.
The global-grid slope is calculated after downsampling elevation to 0.25°,
so it must not be interpreted as rover-scale terrain safety. Use high-
resolution map data for local slope inspection.

Serve the page over HTTP (for example with VS Code Live Server) rather than
opening `index.html` as a `file://` URL. Browser workers and fetches require a
local or hosted web origin.

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