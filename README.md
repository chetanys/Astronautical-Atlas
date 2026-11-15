# Astronautical Atlas

*A research and exploration tool for comparing lunar and Martian regions with Earth environments.*

## 1. Introduction

Future lunar and Martian exploration requires a detailed understanding of extraterrestrial surface environments. Earth-based analog sites can support the study and testing of technologies, operational methods and scientific approaches intended for use in these environments.

This project combines planetary reference workbooks with a web application for exploring potential terrestrial analog environments for mapped regions of the Moon and Mars.

The research covers geological, mineralogical, topographical and environmental parameters. The website provides tools for exploring mapped planetary regions and potential terrestrial analog candidates.

The project includes Moon and Mars quadrangle workbooks, Earth reference data, curated planetary profiles and a source-covered global Earth grid. These are distinct datasets with different purposes.

## 2. What Makes Our Approach Different?

### Multi-parameter comparison

Rather than relying on a single characteristic, the project considers multiple properties of each study area, including terrain, composition, thermal conditions, radiation, water or ice availability and geological characteristics.

### Separate planetary frameworks

The Moon and Mars have different environmental conditions and different available datasets. The project therefore uses separate parameter sets and weighting schemes for each planetary body.

### Mapped quadrangle comparison

In the website, users choose Moon or Mars and select a mapped quadrangle on the chart or from the picker. The API looks up its workbook-backed data and returns ranked Earth analogue candidates.

### Independent global scan

Separately, users can set temperature, elevation, slope and aridity targets and weights to scan the 575,482 source-covered land cells in the approximately 15 km Earth grid. This runs in a browser Web Worker and does not change the quadrangle workflow.

### Research profile browser

The Analogs page presents 115 source-linked Moon and Mars profiles in pages of 20. Users can search, filter by planetary body, inspect available parameters and citations, and review why unsupported spreadsheet fields are excluded. These profiles are research references, not Earth-grid scan candidates.

### Globe and Earth context

The interactive 3D Earth globe displays selected results and supports inspection of candidate details, parameter breakdowns and JSON export. NASA POWER provides live daily 2025 temperature, wind and solar context for a selected Earth analogue. Optional MODIS MOD11A2 day/night surface-temperature context is available for a selected global-grid cell or the top candidates from two 2025 seasonal windows. These live observations add context only; they do not change global-scan rankings.

The Guide explains the workflows and links to a rover field-planning visual example. The example is not official data, a validated simulation, or a rover qualification result.

## 3. Research Methodology

### 3.1 Parameter selection

The project uses a set of physical, geological, mineralogical and environmental parameters to describe planetary study areas. The selected parameters differ between Mars and the Moon in accordance with the datasets and variables included in each planetary framework.

The parameter groups include:
- Study-area geometry and location
- Topography
- Atmospheric conditions
- Surface properties
- Mineralogy
- Rock composition
- Surface roughness
- Daylight duration
- Ice and water
- Geological and geophysical activity
- Geological age

The detailed parameter definitions, units and statistics are documented in the project data files.

### 3.2 Data acquisition and spatial organisation

A key challenge was that planetary data were not consistently available at a common unit-area resolution.

For the Moon and Mars, several datasets provide information by quadrangle. The project therefore uses the quadrangle as the planetary study-area unit and compiles the available parameter statistics for each study area.

For Earth, the research workbook contains 208 geographically distinct terrestrial reference locations, including places such as the Grand Canyon. The website also has a separate gridded Earth dataset for the global scan; the workbook locations and grid cells are not interchangeable.

The Earth locations are not planetary quadrangles; they are terrestrial reference sites selected for comparison using the corresponding parameters where data are available.

### 3.3 Data processing and normalisation

A major limitation during data collection was the lack of sufficient measurements for every individual unit area within a planetary quadrangle. Ideally, each constituent unit would have its own parameter measurement and could be normalised separately. Because this level of detail was not consistently available, the research workbook uses reported average values for parameters where available.

For a parameter with available constituent measurements, the average is:

$$
X_{\mathrm{avg}} = \frac{X_1 + X_2 + \cdots + X_n}{n}
$$

The average value is then used in the min–max normalisation formula:

$$
X_{\mathrm{norm}} =
\frac{X_{\mathrm{avg}} - X_{\min}}
     {X_{\max} - X_{\min}}
$$

Where:
- $X_{\mathrm{avg}}$ is the available average value for the parameter in the study area.
- $X_{\min}$ is the minimum recorded value for that parameter within the same quadrangle.
- $X_{\max}$ is the maximum recorded value for that parameter within the same quadrangle.

This produces a dimensionless value between 0 and 1 when $X_{\max} > X_{\min}$. If the maximum and minimum are equal, the formula is undefined and requires separate handling.

**Important methodological note:** This procedure normalises the quadrangle's average relative to that quadrangle's own observed range. It does not create missing unit-area measurements, correct for differences in quadrangle size, or make independently normalised quadrangles automatically comparable in absolute terms. These constraints are considered in the interpretation of results and are part of the project's current limitations.

This workbook-preparation description is not the algorithm used by the global Earth-grid scan. The website's quadrangle and global-grid rankings are separate implementations; neither should be inferred from this equation alone.

### 3.4 Parameter weighting framework

The research tables below record assigned parameter weights for Mars and the Moon. They document the research framework and should not be read as the set of fields or weights used by every website workflow.

The research framework's weighted score is calculated as:

$$
S = \frac{\sum_i w_i S_i}{\sum_i w_i}
$$

Where:
- $S$ is the overall similarity score.
- $w_i$ is the weight assigned to parameter $i$.
- $S_i$ is the similarity score for parameter $i$.

The weights for each planetary body sum to 100%.

#### Mars parameter weights

| Parameter | Weight |
|---|---:|
| Mean elevation | 4% |
| Slope | 3% |
| Rock composition | 8% |
| Mineral composition | 9% |
| Smoothness | 4% |
| Geological age | 5% |
| Atmospheric pressure | 9% |
| Mean temperature | 8% |
| Thermal inertia | 5% |
| Water/ice | 9% |
| Humidity | 3% |
| Wind speed | 3% |
| Daylight at Ls 90° | 4% |
| Daylight at Ls 270° | 4% |
| Radiation | 8% |
| Geological activity | 5% |
| Quakes | 4% |
| Volcanism | 5% |
| **Total** | **100%** |

#### Moon parameter weights

| Parameter | Weight |
|---|---:|
| Elevation | 6% |
| Slope | 5% |
| Rock composition | 9% |
| Mineral composition | 10% |
| Smoothness | 5% |
| Geological age | 7% |
| Mean temperature | 8% |
| Thermal inertia | 7% |
| Water/ice | 10% |
| Daylight at Ls 90° | 5% |
| Daylight at Ls 270° | 5% |
| Radiation | 9% |
| Geological activity | 6% |
| Quakes | 5% |
| Volcanism | 3% |
| **Total** | **100%** |

The weights shown above are the project's assigned research-framework weights. Their scientific rationale should be documented and validated before drawing scientific conclusions from them. The website's global grid scan uses its own four Earth-grid fields and user-adjustable weights.

### 3.5 Current website ranking methods

The current website does **not** implement a trained ML model. The quadrangle workflow uses a provisional weighted-distance ranking over workbook-backed parameters. The independent global scan uses a browser Web Worker to rank Earth-grid cells against the user's active temperature, elevation, slope and aridity targets; zero-weight fields are excluded. The scan's relative score is not a probability.

Both methods return candidates for further investigation. They have not been established here as mission recommendations, environmental equivalents, or qualification results.

### 3.6 End-to-end application flow

The current application has two separate ranking workflows, described above. The following scoring model and pipeline reproduce the supplied reference design; they are a proposed/reference specification and are **not** the scoring algorithm or architecture currently implemented by this repository.

```mermaid
flowchart TD
    A["1. PLANETARY GROUND TRUTH<br/>Moon/Mars literature + agency products → data/targets.json<br/>(values, Earth-percentile terrain classes, weights, source_url each)"] --> B
    B["2. EARTH DATA LAYER · offline build<br/>src/acquire/build_predictor_stack.py<br/>NASA POWER · GIBS MODIS NDVI · MODIS LST · AWS Terrain Tiles · GLiM rock<br/>→ cache/predictors.zarr (360×720 grid × 9 scored predictors)<br/>+ context: MERRA-2 dust, MODIS snow → cache/context.npz"] --> C
    C["3. SCORING ENGINE · Python, deterministic<br/>similarity · validation · robustness · traverse · qualification<br/>Weighted geometric mean · ranking · novelty · ROC-AUC · leave-one-out"] --> D
    D["4. WEB APPLICATION<br/>FastAPI (src/api/main.py) + static web (Three.js)<br/>Finder globe · site dossier · God's Eye 3D + rover traverse<br/>Validation & Explore views<br/>God's Eye on demand: /api/site3d mosaics AWS Terrarium tiles;<br/>Sentinel-2 cloudless tiles via /api/imagery/... cached in cache/sitetiles/"]
```

#### Per-criterion similarity

For criterion $k$, let $[lo_k,hi_k]$ be its stored editorial range, $[e_{lo,k},e_{hi,k}]$ the Earth envelope, $x_k$ the Earth-cell value, and $t_k$ the planetary target. First clip the target to the range represented on Earth:

$$
t'_k = \operatorname{clip}(t_k;\ e_{lo,k},\ e_{hi,k})
$$

Then calculate the criterion similarity:

$$
s_k(x) =
\operatorname{clip}\left(
1 - \frac{|x_k - t'_k|}{hi_k-lo_k};
0,\ 1
\right)
$$

Targets beyond anything on Earth (for example, a lunar 120 K day–night swing) are clipped to Earth's envelope. The criterion score therefore means “as close as Earth gets.”

#### Combined score (weighted geometric mean)

$$
\operatorname{score}(x) =
\prod_k s_k(x)^{\,w_k / \sum_j w_j}
$$

Here, $w_k$ is the weight for criterion $k$. This geometric-mean score and the reference pipeline above are included to match the supplied design screenshots; the current website still uses the separate provisional quadrangle weighted-distance ranking and browser-based global-grid scan described in §3.5.

## 4. Parameters and Scientific Framework

The research workbooks record the following parameter groups. Not every parameter is measured, available for both planetary bodies, or used by the current website scoring workflows.

| Category | Parameters represented in the project |
|---|---|
| Study area | Latitude and longitude bounds, central coordinates, radius and area |
| Topography | Elevation (minimum, maximum and mean), relief, slope |
| Atmosphere | Temperature, pressure, humidity, wind speed and radiation |
| Surface | Thermal inertia |
| Mineralogy | FeO, TiO₂, MgO, Al₂O₃ and CaO abundance; olivine, pyroxene, plagioclase, clays/phyllosilicates, sulfates, carbonates, chlorides and silica |
| Rock profile | Sedimentary, igneous and metamorphic rock shares |
| Roughness | Roughness rank |
| Daytime hours | Daytime duration at solar longitude (Ls) 90° and 270° |
| Ice and water | Ice percentage and water percentage |
| Activity | Tectonic and volcanic activity shares; quake-related information where available |
| Geology | Geological period or age classification |

The project data dictionary and source workbooks should be consulted for the exact definition, units, availability and statistical treatment of each field.

## 5. Data Sources, Tools and Documentation

The research uses publicly available planetary datasets, mapping resources, scientific publications and reference databases. Links collected from the workbooks are organised by topic in [`SOURCES.md`](SOURCES.md).

The source inventory includes links found in the project's research workbooks, grouped by their associated subject and original workbook location. It should be treated as a working bibliography: links and dataset versions should be checked before final scientific citation.

For the files used by the current website, see the repository table below. The application-specific Earth grid, curated profiles, source-data definitions and Mars reference are stored under `assets/media/`; the API's three Excel inputs are under `api/data/`.

## 6. Limitations and Challenges

The project has several current limitations:

- **Uneven data availability:** Not all parameters are available for every planetary region or terrestrial location.
- **Limited spatial detail:** Some lunar and Martian measurements are available at quadrangle level rather than for each smaller unit area.
- **Different spatial representations:** Planetary quadrangles and named terrestrial reference sites are not inherently equivalent spatial units.
- **Resolution differences:** Datasets may have different spatial resolutions, observation periods and measurement methods.
- **Normalisation constraints:** Normalising a quadrangle's mean against its own minimum and maximum gives a local relative value; it does not guarantee direct absolute comparability between different quadrangles or with Earth.
- **Measurement uncertainty:** Remotely sensed and derived measurements may contain uncertainty and depend on instrument and processing methods.
- **Parameter availability differs by body:** The Moon and Mars do not have identical parameter sets. For example, atmospheric parameters included in the Mars framework are not included in the current Moon weighting table.
- **Distinct Earth and planetary datasets:** The named Earth workbook locations, curated planetary profiles and gridded Earth scan serve different purposes and should not be conflated.
- **Model validation:** The rankings have not been independently validated for use as field-site recommendations or mission qualification.
- **Source periods:** Sources have different observation periods. Elevation products are static, and some planetary references are historical; for example, the Mars MOLA terrain product is based on 1997–2001 observations. A recent archive or access date does not make the underlying observations recent.

The identified terrestrial locations should therefore be interpreted as potential analogs based on the selected parameters, not as exact replicas of extraterrestrial environments.

## 7. Future Scope

Future development can expand the project's data coverage, improve spatial comparability and strengthen validation.

Planned directions include:

- **Research dataset expansion:** Extend the 208-location terrestrial reference workbook with documented, consistently sourced sites.
- **Higher-resolution planetary data:** Incorporate more detailed measurements as suitable datasets become available.
- **Improved data harmonisation:** Account more explicitly for differences in spatial resolution, measurement methods, observation periods and study-area size.
- **Model validation:** Define reproducible evaluation methods and test ranking stability before making predictive or operational claims.
- **Source maintenance:** Refresh Earth-side climate snapshots when complete, verified input periods are available, while retaining clear observation dates and provenance for static and historical planetary products.

## 8. Acknowledgements

We acknowledge the space agencies, scientific institutions, researchers and data providers whose publicly available observations, maps, datasets and publications support this project.

These resources include planetary science and mapping materials from NASA and its Jet Propulsion Laboratory, the United States Geological Survey (USGS), the European Space Agency (ESA), and other institutions and research groups represented in the project's source inventory.

We are grateful to the researchers and mission teams whose work makes comparative planetary research and the study of terrestrial analog environments possible.

A topic-wise list of the links collected from the project's research workbooks is available in [`SOURCES.md`](SOURCES.md). Individual datasets and publications should be cited with their specific titles, providers, versions and access details when used in the final analysis.

## 9. Repository Contents

The repository includes the research data and the runnable website/API:

| File or folder | Description |
|---|---|
| `index.html` | Website pages and application markup |
| `assets/css/` and `assets/js/` | Website styling, interface logic and global-grid Web Worker |
| `assets/media/earth_grid.bin` and `earth_grid.json` | Binary global Earth grid and its metadata |
| `assets/media/curated_reference_profiles.json` | Source-linked Moon/Mars profile catalog |
| `assets/media/source-data/` | Parameter definitions used by the website |
| `assets/media/mars_reference.json` | Mars terrain reference data and provenance |
| `assets/media/earth.glb` and `perseverance.glb` | Local 3D Earth and rover model assets |
| `api/main.py` | FastAPI quadrangle analogue and MODIS proxy endpoints |
| `api/data/earth_data.xlsx`, `mars_data.xlsx`, `moon_data.xlsx` | Workbooks loaded by the API at startup |
| `api/requirements.txt` | Python API dependencies |
| `SOURCES.md` | Topic-wise inventory of collected research links |
| `README.md` | Research background, current implementation, limitations and local run instructions |

## 10. Project Information

- **Challenge:** NASA Space Apps Challenge
- **Project:** Astronautical Atlas
- **Team:** [TEAM NAME]
- **Website:** Local application; deployment not configured or validated
- **Repository:** https://github.com/chetanys/Astronautical-Atlas

---

*This project is a research and comparative-analysis framework. Identified terrestrial locations are potential environmental analogs based on the parameters and datasets available; they should not be interpreted as exact physical equivalents of lunar or Martian sites.*

## 11. Download and Run the Website Locally

### Before you start

- Git
- Python 3.10 or later
- Internet access for NASA POWER and ORNL DAAC MODIS requests

No Node.js installation is needed. The website files and the three API workbooks (`api/data/mars_data.xlsx`, `api/data/moon_data.xlsx` and `api/data/earth_data.xlsx`) are included in the repository. The Python API dependencies are listed in `api/requirements.txt`. Keep the workbooks in that folder, and do not commit your local `.venv` environment.

### Download the project

Open a terminal and run these commands to download the project:

```sh
git clone https://github.com/chetanys/Astronautical-Atlas.git
cd Astronautical-Atlas
```

If you already downloaded or extracted the project, skip `git clone` and open a terminal in the project folder instead. This is the folder containing `index.html`, `README.md` and the `api` folder.

### Install the API dependencies

Run the commands for your operating system from the project folder (the folder containing `index.html`). This creates a private Python environment named `.venv` and installs the API packages into it.

**macOS or Linux**

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r api/requirements.txt
```

**Windows PowerShell**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r api/requirements.txt
```

If PowerShell says script execution is disabled, open **Command Prompt** in the project folder and run:

```bat
py -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r api\requirements.txt
```

### Start the website

The application needs two servers running at the same time. Keep both terminal windows open while using it.

Open **Terminal 1** in the project folder. You do not need to activate `.venv` in this terminal.

**macOS or Linux**
```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

**Windows PowerShell or Command Prompt**
```powershell
py -m http.server 5173 --bind 127.0.0.1
```

### Start the API

Open **Terminal 2** in the same project folder. Activate the environment, change into `api`, and start the API using the commands for your operating system:

**macOS or Linux**
```sh
source .venv/bin/activate
cd api
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Windows PowerShell**
```powershell
.\.venv\Scripts\Activate.ps1
cd api
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Windows Command Prompt**
```bat
.venv\Scripts\activate.bat
cd api
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

When the API starts, its terminal should say it is running on `http://127.0.0.1:8000`. You can check it by opening [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health); it should show `{"status":"running"}`.

Now open the website at [http://127.0.0.1:5173](http://127.0.0.1:5173). Do not open `index.html` directly as a `file://` URL: the website's worker, data files and API need to be served over HTTP.

If the API reports that port `8000` is already in use, stop the other server using that port or change the API command in Terminal 2 to port `8011`:

```sh
python -m uvicorn main:app --host 127.0.0.1 --port 8011
```

Then open the website with the API address added to the URL:

```text
http://127.0.0.1:5173/?api=http%3A%2F%2F127.0.0.1%3A8011
```

To stop either server, select its terminal and press **Ctrl+C**.

### Use the application

1. Open **Application** and choose **Moon** or **Mars**.
2. Select a quadrangle on the map or from the quadrangle menu, then choose **Find Earth Analogues** to query the workbook-backed ranking.
3. Use **Independent Global Scan** below it to set the four Earth-grid targets and weights, then select **Scan Global Grid**. Choose a result to inspect it on the globe.
4. Select a ranked grid cell or mapped Earth analogue to inspect its available details. The NASA POWER panel loads daily 2025 temperature, wind and solar context on demand; the export control downloads the selected site profile as JSON.
5. To request optional MODIS context for an Earth grid result, select it and choose **Load for Selected Cell**. The multi-cell option requests more upstream data and may take longer. MODIS is context only and does not change rankings.
6. Open **Analogs** to search and filter the separate Moon/Mars reference catalog and inspect citations. The **Guide** contains workflow instructions and the clearly labeled illustrative rover walkthrough.

Live NASA POWER and MODIS requests require internet access and may be unavailable or slow when upstream services are down. The local API and workbook-backed quadrangle ranking are not provided by GitHub Pages alone. Vercel deployment is not configured or validated; use the local steps above unless a compatible backend deployment is separately set up and tested.
