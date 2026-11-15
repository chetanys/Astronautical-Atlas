# Astronautical Atlas

*A data-driven framework for identifying terrestrial analogs of lunar and Martian environments.*

## 1. Introduction

Future lunar and Martian exploration requires a detailed understanding of extraterrestrial surface environments. Earth-based analog sites can support the study and testing of technologies, operational methods and scientific approaches intended for use in these environments.

This project develops a comparative planetary database and a coordinate-based system for identifying terrestrial environments with characteristics similar to selected locations on the Moon and Mars.

The research brings together geological, mineralogical, topographical and environmental parameters. These parameters are organised into a structured dataset and used by a machine-learning component on the project website to compare extraterrestrial study areas with terrestrial reference locations.

The project currently includes:
- A lunar and Martian parameter database organised around planetary study areas and quadrangles.
- An initial terrestrial reference dataset containing 208 locations.
- A parameter-weighting framework with separate weights for Mars and the Moon.
- A website workflow intended to accept planetary coordinates and return comparable terrestrial locations.

## 2. What Makes Our Approach Different?

### Multi-parameter comparison

Rather than relying on a single characteristic, the project considers multiple properties of each study area, including terrain, composition, thermal conditions, radiation, water or ice availability and geological characteristics.

### Separate planetary frameworks

The Moon and Mars have different environmental conditions and different available datasets. The project therefore uses separate parameter sets and weighting schemes for each planetary body.

### Coordinate-based discovery

The intended website workflow starts with a user-selected location. The user enters lunar or Martian coordinates; the system identifies the corresponding study area or quadrangle, retrieves its parameter data and compares it with the terrestrial reference database.

### Beyond a fixed list of analog sites

The current terrestrial dataset contains 208 locations. A future goal is to expand this into a more systematic global reference database, rather than relying only on a fixed collection of named sites.

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

For Earth, equivalent parameter information was collected for 208 geographically distinct terrestrial locations, including places such as the Grand Canyon. These locations form the initial terrestrial reference dataset.

The Earth locations are not planetary quadrangles; they are terrestrial reference sites selected for comparison using the corresponding parameters where data are available.

### 3.3 Data processing and normalisation

A major limitation during data collection was the lack of sufficient measurements for every individual unit area within a planetary quadrangle. Ideally, each constituent unit would have its own parameter measurement and could be normalised separately. Because this level of detail was not consistently available, the project uses the reported average value for each parameter within a quadrangle.

For a parameter with available constituent measurements, the average can be represented as:

\[
X_{\mathrm{avg}}=\frac{X_1+X_2+\cdots+X_n}{n}
\]

The average value is then used in the min-max normalisation formula:

\[
X_{\mathrm{norm}}=
\frac{X_{\mathrm{avg}}-X_{\min}}
{X_{\max}-X_{\min}}
\]

Where:
- \(X_{\mathrm{avg}}\) is the available average value for the parameter in the study area.
- \(X_{\min}\) is the minimum recorded value for that parameter within the same quadrangle.
- \(X_{\max}\) is the maximum recorded value for that parameter within the same quadrangle.

This produces a dimensionless value between 0 and 1 when \(X_{\max}>X_{\min}\). If the maximum and minimum are equal, the formula is undefined and requires separate handling.

**Important methodological note:** This procedure normalises the quadrangle's average relative to that quadrangle's own observed range. It does not create missing unit-area measurements, correct for differences in quadrangle size, or make independently normalised quadrangles automatically comparable in absolute terms. These constraints are considered in the interpretation of results and are part of the project's current limitations.

### 3.4 Parameter weighting framework

The project uses separate parameter weights for Mars and the Moon. The weights represent each parameter's assigned contribution to the overall weighted similarity score.

The weighted score is calculated using:

\[
S=\frac{\sum_i w_iS_i}{\sum_i w_i}
\]

Where:
- \(S\) is the overall similarity score.
- \(w_i\) is the weight assigned to parameter \(i\).
- \(S_i\) is the similarity score for parameter \(i\).

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

The weights shown above are the project's current assigned weights. The scientific rationale and procedure used to determine each weight should be documented alongside the model as the weighting framework is validated and refined.

### 3.5 Machine-learning-based analog identification

The project website incorporates a machine-learning component intended to compare planetary study areas with terrestrial reference locations.

The planned user workflow is:

1. The user enters the latitude and longitude of a location on the Moon or Mars.
2. The system identifies the corresponding planetary quadrangle or study area.
3. The system retrieves the available parameter values and processed data for that area.
4. The model compares the planetary parameter profile with the terrestrial reference dataset.
5. The website presents terrestrial locations identified as potential analogs.

The purpose is to help users explore Earth environments that share selected characteristics with a chosen lunar or Martian location.

The exact model architecture, training procedure, validation metrics and method used to calculate each individual parameter similarity should be documented with the implementation. A normalised parameter value should not be treated as a similarity score by itself; the comparison method must define how the difference or similarity between the planetary and terrestrial values is calculated.

## 4. Parameters and Scientific Framework

The project records the following parameter groups. Not every parameter is available for both planetary bodies.

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

The research uses publicly available planetary datasets, mapping resources, scientific publications and reference databases. The sources collected during the project are organised by topic in [`SOURCES.md`](SOURCES.md).

The source inventory includes links found in the project's research workbooks, grouped by their associated subject and original workbook location. It should be treated as a working bibliography: links and dataset versions should be checked before final scientific citation.

Project data and supporting files include:
- Lunar and Martian machine-learning data templates.
- Mars geographical features database.
- Mars classification reference.
- Combined Mars and Moon planetary database.
- Parameter definitions and data dictionaries.

## 6. Limitations and Challenges

The project has several current limitations:

- **Uneven data availability:** Not all parameters are available for every planetary region or terrestrial location.
- **Limited spatial detail:** Some lunar and Martian measurements are available at quadrangle level rather than for each smaller unit area.
- **Different spatial representations:** Planetary quadrangles and named terrestrial reference sites are not inherently equivalent spatial units.
- **Resolution differences:** Datasets may have different spatial resolutions, observation periods and measurement methods.
- **Normalisation constraints:** Normalising a quadrangle's mean against its own minimum and maximum gives a local relative value; it does not guarantee direct absolute comparability between different quadrangles or with Earth.
- **Measurement uncertainty:** Remotely sensed and derived measurements may contain uncertainty and depend on instrument and processing methods.
- **Parameter availability differs by body:** The Moon and Mars do not have identical parameter sets. For example, atmospheric parameters included in the Mars framework are not included in the current Moon weighting table.
- **Initial terrestrial coverage:** The Earth reference dataset currently contains 208 locations and is not yet a complete global spatial database.
- **Model validation:** The reliability of analog results depends on the quality, coverage and comparability of input data, as well as the model's validation.

The identified terrestrial locations should therefore be interpreted as potential analogs based on the selected parameters, not as exact replicas of extraterrestrial environments.

## 7. Future Scope

Future development aims to expand the project's data coverage, improve spatial comparability and strengthen the analog identification system.

Planned directions include:

- **Global terrestrial coverage:** Expand the current 208-site Earth dataset into a global database.
- **Regular spatial tiling:** Work towards dividing Earth's surface into square tiles with a target area of 15 km², subject to data availability and a consistent spatial-grid definition.
- **Higher-resolution planetary data:** Incorporate more detailed measurements as suitable datasets become available.
- **Improved data harmonisation:** Account more explicitly for differences in spatial resolution, measurement methods, observation periods and study-area size.
- **Model development and validation:** Document the ML architecture, test its performance and evaluate the stability of its analog rankings.
- **More transparent comparisons:** Show users the parameter-level comparisons and contributions behind the identified analog locations.
- **Interactive mapping:** Develop the coordinate-based website experience to display the selected planetary region and its corresponding terrestrial analogs.

## 8. Acknowledgements

We acknowledge the space agencies, scientific institutions, researchers and data providers whose publicly available observations, maps, datasets and publications support this project.

These resources include planetary science and mapping materials from NASA and its Jet Propulsion Laboratory, the United States Geological Survey (USGS), the European Space Agency (ESA), and other institutions and research groups represented in the project's source inventory.

We are grateful to the researchers and mission teams whose work makes comparative planetary research and the study of terrestrial analog environments possible.

A topic-wise list of the links collected from the project's research workbooks is available in [`SOURCES.md`](SOURCES.md). Individual datasets and publications should be cited with their specific titles, providers, versions and access details when used in the final analysis.

## 9. Repository Contents

The repository contains the research datasets, classification references, parameter documentation and supporting materials used to develop the planetary comparison framework.

| File or folder | Description |
|---|---|
| `SOURCES.md` | Topic-wise inventory of collected research links |
| `Lunar_ML_Data_Template.xlsx` | Lunar parameter dataset/template |
| `Mars_ML_Data_Template.xlsx` | Mars parameter dataset/template |
| `mars_classification_reference.xlsx` | Classification reference material |
| `Mars_Geographical_Features_Database.xlsx` | Mars geographical features reference |
| `mars_moon_planetary_database.xlsx` | Combined planetary database |
| `README.md` | Project overview, methodology and documentation |

*Update this table to match the final filenames and folders in the GitHub repository.*

## 10. Project Information

- **Challenge:** NASA Space Apps Challenge
- **Project:** [PROJECT NAME]
- **Team:** [TEAM NAME]
- **Website:** [ADD WEBSITE LINK]
- **Repository:** [ADD REPOSITORY LINK]

---

*This project is a research and comparative-analysis framework. Identified terrestrial locations are potential environmental analogs based on the parameters and datasets available; they should not be interpreted as exact physical equivalents of lunar or Martian sites.*
