
const LOW_LIGHT_THRESHOLD = 10;
const EARTH_OBLIQUITY = 23.44;
const MARS_OBLIQUITY = 25.19;
const MONTHS = [
  ["JAN", "Jan"], ["FEB", "Feb"], ["MAR", "Mar"], ["APR", "Apr"],
  ["MAY", "May"], ["JUN", "Jun"], ["JUL", "Jul"], ["AUG", "Aug"],
  ["SEP", "Sep"], ["OCT", "Oct"], ["NOV", "Nov"], ["DEC", "Dec"]
];
let mode = "moon";
let globe;
let markers = [];
let gridMarkers = [];
let selectedSite = null;
let gridWorker = null;
let gridReady = false;
let gridHasResults = false;
let gridScanResults = [];
let gridScoreScales = null;
let selectedSubsystem = "wheels";
let curatedProfiles = [];
let curatedProfilesLoad = null;
let curatedProfilePage = 0;
let selectedCuratedProfileId = null;
const CURATED_PROFILES_PER_PAGE = 20;
const climateCache = new Map();
const powerCache = new Map();
const regionalPowerCache = new Map();
const modisCache = new Map();
const MODIS_WINDOWS = [
  ["A2023001", "A2023073"],
  ["A2023177", "A2023249"]
];
const MODIS_REQUEST_TIMEOUT_MS = 90_000;
let selectedGridResult = null;
const gridResultRows = new Map();
let activeClimateKey = null;
let climateRequestId = 0;

const $ = id => document.getElementById(id);

customElements.whenDefined("model-viewer").then(() => {
  const ModelViewerElement = customElements.get("model-viewer");
  if (ModelViewerElement) ModelViewerElement.minimumRenderScale = 1;
});

function winterSolstice(latitude) {
  const isNorthernWinter = latitude >= 0;
  const obliquity = mode === "mars" ? MARS_OBLIQUITY : EARTH_OBLIQUITY;
  const declination = isNorthernWinter
    ? -obliquity
    : obliquity;

  return {
    date: mode === "mars"
      ? "MARS SOLSTICE"
      : isNorthernWinter
        ? "DEC SOLSTICE · 21 DEC REF"
        : "JUN SOLSTICE · 21 JUN REF",
    season: isNorthernWinter ? "NORTHERN WINTER" : "SOUTHERN WINTER",
    elevation: 90 - Math.abs(latitude - declination)
  };
}

function formatLatitude(latitude) {
  if (latitude === 0) return "0°";
  return `${Math.abs(latitude).toFixed(1)}° ${latitude < 0 ? "S" : "N"}`;
}

function updateSunCalculator(latitude) {
  const { date, season, elevation } = winterSolstice(latitude);
  const lowLight = elevation <= LOW_LIGHT_THRESHOLD;
  const night = elevation <= 0;
  const shadowLine = $("shadowLine");
  const shadowDiagram = $("shadowDiagram");
  $("sunLatitudeValue").textContent = formatLatitude(latitude);
  $("sunSolstice").textContent = `${date} · ${season}`;
  $("sunHint").textContent = mode === "mars"
    ? "Estimate the local winter Sun using Mars's 25.19° axial tilt."
    : "Move the latitude slider to compare the local winter Sun with the lunar south-pole limit.";
  $("solarReference").textContent = mode === "mars"
    ? `Mars axial tilt: ${MARS_OBLIQUITY}°. Solstice geometry only; seasons do not share Earth's calendar dates.`
    : "Lunar south pole: Sun never exceeds 7° above the horizon.";
  $("sunElevation").textContent =
    `${elevation < 0 ? "−" : ""}${Math.abs(elevation).toFixed(1)}°`;
  shadowDiagram.classList.toggle("night", night);

  if (night) {
    $("shadowLength").textContent = "NIGHT";
    $("shadowCaption").textContent =
      "The Sun is below the horizon at winter-solstice noon.";
    $("shadowDescription").textContent =
      "The Sun is below the horizon, so there is no direct sunlight or cast shadow.";
    shadowLine.setAttribute("x2", "350");
  } else {
    const shadowMeters = 1 / Math.tan(elevation * Math.PI / 180);
    const displayedLength = Math.min(shadowMeters, 60);
    shadowLine.setAttribute(
      "x2",
      String((350 - displayedLength * 5.5).toFixed(1))
    );
    $("shadowLength").textContent = shadowMeters > 60
      ? ">60 m"
      : `${shadowMeters.toFixed(1)} m`;
    $("shadowCaption").textContent = shadowMeters > 60
      ? "Calculated shadow exceeds the 60 m illustration scale."
      : "Calculated for a 1 m rover at local winter-solstice noon.";
    $("shadowDescription").textContent =
      `A one-meter rover casts a ${shadowMeters.toFixed(1)} meter shadow at a Sun elevation of ${elevation.toFixed(1)} degrees.`;
  }

  $("sunRisk").textContent = lowLight
    ? `LOW-LIGHT ZONE · WINTER SUN ${elevation < 0 ? "STAYS BELOW THE HORIZON" : "STAYS AT OR BELOW 10°"}`
    : "WINTER SUN EXCEEDS THE 10° LOW-LIGHT THRESHOLD";
  $("sunRisk").classList.toggle("low-light", lowLight);
}

function globePosition(site, radius = 505) {
  const latitude = site.lat * Math.PI / 180;
  // The NASA model's +Z axis points opposite the geographic longitude origin.
  const longitude = (site.lon + 180) * Math.PI / 180;
  const horizontalRadius = radius * Math.cos(latitude);
  const x = horizontalRadius * Math.sin(longitude);
  const y = radius * Math.sin(latitude);
  const z = horizontalRadius * Math.cos(longitude);

  return {
    position: `${x.toFixed(2)}m ${y.toFixed(2)}m ${z.toFixed(2)}m`,
    normal: `${(x / radius).toFixed(4)} ${(y / radius).toFixed(4)} ${(z / radius).toFixed(4)}`
  };
}

function gridTarget() {
  return {
    temperature: Number($("gridTemperature").value),
    elevation: Number($("gridElevation").value),
    slope: Number($("gridSlope").value),
    aridity: Number($("gridAridity").value),
    weights: {
      temperature: Number($("weightTemperature").value),
      elevation: Number($("weightElevation").value),
      slope: Number($("weightSlope").value),
      aridity: Number($("weightAridity").value)
    }
  };
}

function gridCellId(result) {
  return `cell_${result.latitude.toFixed(4)}_${result.longitude.toFixed(4)}`;
}

function renderGridPowerMetrics(data) {
  const metrics = [
    ["MEAN AIR TEMP", `${data.t_mean.toFixed(1)} °C`],
    ["CLIMATOLOGY MAX", `${data.t_max.toFixed(1)} °C`],
    ["CLIMATOLOGY MIN", `${data.t_min.toFixed(1)} °C`],
    ["PRECIPITATION", `${data.precip_mm_day.toFixed(2)} mm/day`]
  ];
  const container = $("gridPowerMetrics");
  container.replaceChildren();
  metrics.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "grid-power-metric";
    const term = document.createElement("span");
    const description = document.createElement("b");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    container.appendChild(item);
  });
  container.classList.remove("hidden");
}

function renderRegionalPowerMetrics(data) {
  const metrics = [
    ["REGIONAL MEAN", `${data.mean.toFixed(1)} °C`],
    ["REGIONAL MIN", `${data.minimum.toFixed(1)} °C`],
    ["REGIONAL MAX", `${data.maximum.toFixed(1)} °C`],
    ["VALID GRID SAMPLES", String(data.count)]
  ];
  const container = $("regionalPowerMetrics");
  container.replaceChildren();
  metrics.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "grid-power-metric";
    const term = document.createElement("span");
    const description = document.createElement("b");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    container.appendChild(item);
  });
  container.classList.remove("hidden");
}

function fetchPower(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (powerCache.has(key)) return powerCache.get(key);

  const url = new URL(
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
  );
  url.search = new URLSearchParams({
    parameters: "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR",
    community: "RE",
    longitude: String(lon),
    latitude: String(lat),
    format: "JSON"
  }).toString();

  const request = fetch(url).then(async response => {
    if (!response.ok) {
      throw new Error(`NASA POWER request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const parameters = payload?.properties?.parameter;
    const values = {
      t_mean: parameters?.T2M?.ANN,
      t_max: parameters?.T2M_MAX?.ANN,
      t_min: parameters?.T2M_MIN?.ANN,
      precip_mm_day: parameters?.PRECTOTCORR?.ANN
    };
    if (!Object.values(values).every(value =>
      typeof value === "number" && Number.isFinite(value) && value !== -999
    )) {
      throw new Error("NASA POWER returned incomplete climatology data.");
    }
    return {
      ...values,
      source: "NASA POWER climatology",
      period: payload?.header?.range ?? "January 2001–December 2025",
      fetched: new Date().toISOString()
    };
  });

  powerCache.set(key, request);
  request.catch(() => powerCache.delete(key));
  return request;
}

function regionalPowerBounds(latitude, longitude) {
  const latitudeMin = Math.max(-90, Math.min(latitude - 1, 88));
  const longitudeMin = Math.max(-180, Math.min(longitude - 1, 178));
  return {
    latitudeMin,
    latitudeMax: latitudeMin + 2,
    longitudeMin,
    longitudeMax: longitudeMin + 2
  };
}

function fetchPowerRegional(latitude, longitude) {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  if (regionalPowerCache.has(key)) return regionalPowerCache.get(key);

  const bounds = regionalPowerBounds(latitude, longitude);
  const url = new URL(
    "https://power.larc.nasa.gov/api/temporal/climatology/regional"
  );
  url.search = new URLSearchParams({
    "latitude-min": String(bounds.latitudeMin),
    "latitude-max": String(bounds.latitudeMax),
    "longitude-min": String(bounds.longitudeMin),
    "longitude-max": String(bounds.longitudeMax),
    parameters: "T2M",
    community: "RE",
    format: "JSON"
  }).toString();

  const request = fetch(url).then(async response => {
    if (!response.ok) {
      throw new Error(
        `NASA POWER regional request failed with status ${response.status}.`
      );
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.features)) {
      throw new Error("NASA POWER regional response did not contain grid features.");
    }
    const samples = payload.features.flatMap(feature => {
      const coordinates = feature?.geometry?.coordinates;
      const temperature = feature?.properties?.parameter?.T2M?.ANN;
      if (
        !Array.isArray(coordinates) ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1]) ||
        !Number.isFinite(temperature) ||
        temperature === -999
      ) {
        return [];
      }
      return [{
        longitude: coordinates[0],
        latitude: coordinates[1],
        temperature
      }];
    });
    if (!samples.length) {
      throw new Error("NASA POWER regional response contained no valid T2M samples.");
    }
    const temperatures = samples.map(sample => sample.temperature);
    return {
      ...bounds,
      count: samples.length,
      minimum: Math.min(...temperatures),
      mean: temperatures.reduce((sum, value) => sum + value, 0) / samples.length,
      maximum: Math.max(...temperatures),
      period: payload?.header?.range ?? "NASA POWER climatology",
      fetched: new Date().toISOString()
    };
  });

  regionalPowerCache.set(key, request);
  request.catch(() => regionalPowerCache.delete(key));
  return request;
}

async function fetchModisWindow(lat, lon, band, startDate, endDate) {
  const url = new URL("/api/modis", window.location.origin);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    band,
    window: `${startDate}:${endDate}`
  }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    MODIS_REQUEST_TIMEOUT_MS
  );
  let payload;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`MODIS request failed with status ${response.status}.`);
    }
    payload = await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("MODIS request timed out after 90 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const scale = Number.parseFloat(payload.scale ?? payload.header?.scale ?? "0.02");
  if (!Number.isFinite(scale) || scale <= 0 || !Array.isArray(payload.subset)) {
    throw new Error("ORNL MODIS response has an invalid scale or subset.");
  }
  const values = payload.subset
    .flatMap(item => Array.isArray(item.data) ? item.data : [])
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0 && value < 65535)
    .map(value => value > 1000 ? value * scale : value)
    .filter(kelvin => kelvin > 150 && kelvin < 360);
  if (!values.length) {
    throw new Error("ORNL MODIS returned no valid temperature samples.");
  }
  return values;
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function fetchModis(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (modisCache.has(key)) return modisCache.get(key);
  const getWindows = band => Promise.all(MODIS_WINDOWS.map(
    ([start, end]) => fetchModisWindow(lat, lon, band, start, end)
  ));
  const request = Promise.all([
    getWindows("LST_Day_1km"),
    getWindows("LST_Night_1km")
  ]).then(([dayWindows, nightWindows]) => {
    const day = dayWindows.flat();
    const night = nightWindows.flat();
    if (!day.length || !night.length) {
      throw new Error("ORNL MODIS returned incomplete day/night samples.");
    }
    return {
      day_max_K: Math.max(...day),
      night_min_K: Math.min(...night),
      diurnal_range_K: mean(dayWindows.map(mean)) - mean(nightWindows.map(mean)),
      source: "MODIS MOD11A2 via ORNL DAAC web service",
      period: "2023 seasonal windows · DOY 001–073 and 177–249",
      fetched: new Date().toISOString()
    };
  });
  modisCache.set(key, request);
  request.catch(() => modisCache.delete(key));
  return request;
}

function renderGridModisMetrics(data) {
  const metrics = [
    ["DAY MAX · SAMPLED", `${data.day_max_K.toFixed(1)} K`],
    ["NIGHT MIN · SAMPLED", `${data.night_min_K.toFixed(1)} K`],
    ["MEAN DIURNAL RANGE", `${data.diurnal_range_K.toFixed(1)} K`]
  ];
  const container = $("gridModisMetrics");
  container.replaceChildren();
  metrics.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "grid-power-metric";
    const term = document.createElement("span");
    const description = document.createElement("b");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    container.appendChild(item);
  });
  container.classList.remove("hidden");
}

async function updateGridModis(result, element, selected = false) {
  const cellId = gridCellId(result);
  const isSelected = () => selectedGridResult &&
    gridCellId(selectedGridResult) === cellId;
  element.textContent = "MODIS MOD11A2: loading live seasonal sample…";
  if (selected) {
    $("gridModisMetrics").classList.add("hidden");
    $("retryGridModis").classList.add("hidden");
    $("gridModisStatus").textContent =
      "Loading live MODIS sample from ORNL DAAC · 2023 seasonal windows…";
  }
  try {
    const data = await fetchModis(result.latitude, result.longitude);
    element.textContent =
      `MODIS sampled live via ORNL DAAC: day max ${data.day_max_K.toFixed(1)} K · ` +
      `night min ${data.night_min_K.toFixed(1)} K`;
    if (isSelected()) {
      $("gridModisStatus").textContent =
        `Live from ORNL DAAC · MODIS surface temperature, sampled from two seasonal ` +
        `windows in 2023 · point-area sample, not the 15 km tile mean · ` +
        `context only; does not change ranking · fetched ${new Date(data.fetched).toLocaleString()}.`;
      renderGridModisMetrics(data);
    }
    return true;
  } catch (error) {
    console.error("Could not load live ORNL MODIS data.", error);
    element.textContent = "MODIS unavailable. Select this cell to retry.";
    if (isSelected()) {
      $("gridModisStatus").textContent =
        "MODIS unavailable. Retry the live ORNL DAAC lookup.";
      $("retryGridModis").classList.remove("hidden");
    }
    return false;
  }
}

async function updateGridPower(result, element, selected = false) {
  if (selected) {
    $("gridClimateHeading").textContent =
      `Selected cell · ${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    $("gridPowerStatus").textContent = "Loading live NASA POWER climatology…";
    $("gridPowerMetrics").classList.add("hidden");
    $("retryGridPower").classList.add("hidden");
  }
  element.textContent = "NASA POWER: loading live climatology…";

  try {
    const data = await fetchPower(result.latitude, result.longitude);
    element.textContent =
      `NASA POWER live: ${data.t_mean.toFixed(1)} °C mean · ` +
      `${data.precip_mm_day.toFixed(2)} mm/day precipitation`;
    if (selectedGridResult &&
        gridCellId(selectedGridResult) === gridCellId(result)) {
      $("gridPowerStatus").textContent =
        `Live from NASA POWER · ${data.period} · fetched ${new Date(data.fetched).toLocaleString()}.`;
      renderGridPowerMetrics(data);
    }
  } catch (error) {
    console.error("Could not load NASA POWER data for a grid cell.", error);
    element.textContent = "NASA POWER: unavailable; select the row to retry.";
    if (selected && selectedGridResult &&
        gridCellId(selectedGridResult) === gridCellId(result)) {
      $("gridPowerStatus").textContent = "NASA POWER unavailable. Retry the live lookup.";
      $("retryGridPower").classList.remove("hidden");
    }
  }
}

async function loadRegionalPowerContext() {
  const candidateSelect = $("analogRegionalCandidate");
  const result = gridScanResults[Number(candidateSelect.value)];
  if (!result) {
    $("regionalPowerStatus").textContent =
      "Choose a candidate from the latest scan before loading regional context.";
    return;
  }
  selectedGridResult = result;
  const cellId = gridCellId(result);
  const button = $("loadRegionalPower");
  candidateSelect.disabled = true;
  button.disabled = true;
  button.textContent = "LOADING REGIONAL TEMPERATURE…";
  $("regionalPowerStatus").textContent =
    "Requesting one NASA POWER T2M regional climatology for the selected cell's 2° × 2° neighborhood…";
  $("regionalPowerMetrics").classList.add("hidden");

  try {
    const data = await fetchPowerRegional(result.latitude, result.longitude);
    if (!selectedGridResult || gridCellId(selectedGridResult) !== cellId) return;
    $("regionalPowerStatus").textContent =
      `NASA POWER regional T2M · ${data.count} valid grid samples · ` +
      `${data.latitudeMin.toFixed(1)}° to ${data.latitudeMax.toFixed(1)} latitude, ` +
      `${data.longitudeMin.toFixed(1)}° to ${data.longitudeMax.toFixed(1)} longitude · ` +
      `${data.period} · fetched ${new Date(data.fetched).toLocaleString()}. ` +
      "Neighborhood context only; it does not change the global scan.";
    renderRegionalPowerMetrics(data);
    button.textContent = "REFRESH REGIONAL TEMPERATURE";
  } catch (error) {
    if (!selectedGridResult || gridCellId(selectedGridResult) !== cellId) return;
    const message = error instanceof Error ? error.message : String(error);
    $("regionalPowerStatus").textContent =
      `NASA POWER regional context unavailable: ${message}`;
    button.textContent = "RETRY REGIONAL TEMPERATURE";
    console.error("Could not load NASA POWER regional context.", error);
  } finally {
    candidateSelect.disabled = gridScanResults.length === 0;
    button.disabled = gridScanResults.length === 0 || !candidateSelect.value;
  }
}

function selectGridResult(result) {
  selectedGridResult = result;
  const regionalSelect = $("analogRegionalCandidate");
  const resultIndex = gridScanResults.findIndex(
    candidate => gridCellId(candidate) === gridCellId(result)
  );
  if (resultIndex >= 0) regionalSelect.value = String(resultIndex);
  $("loadRegionalPower").disabled = resultIndex < 0;
  $("regionalPowerStatus").textContent =
    "Select LOAD REGIONAL TEMPERATURE to fetch the optional 2° neighborhood context.";
  $("regionalPowerMetrics").replaceChildren();
  $("regionalPowerMetrics").classList.add("hidden");
  $("loadRegionalPower").textContent = "LOAD REGIONAL TEMPERATURE";
  focusSite({ lat: result.latitude, lon: result.longitude });
  const coordinates =
    `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
  $("coordinates").textContent = `GRID CELL · ${coordinates}`;
  updateGridPower(result, $("gridPowerStatus"), true);
  updateGridModis(result, $("gridModisStatus"), true);
}

async function enrichTopGridResults(results) {
  const topTen = results.slice(0, 10);
  for (let index = 0; index < topTen.length; index += 3) {
    const batch = topTen.slice(index, index + 3);
    await Promise.allSettled(batch.map(async result => {
      const row = gridResultRows.get(gridCellId(result));
      if (!row) return;
      await updateGridPower(result, row.power);
    }));
  }
}

async function loadModisForTopTen() {
  const button = $("loadTopTenModis");
  const status = $("topTenModisStatus");
  const activeResults = gridScanResults;
  const results = activeResults.slice(0, 10);
  if (!results.length) return;
  button.disabled = true;
  status.textContent =
    `Loading MODIS for ${results.length} results · four requests per cell, ` +
    "processed one cell at a time; each request may take up to 90 seconds…";
  let completed = 0;
  let unavailable = 0;
  for (const result of results) {
    if (gridScanResults !== activeResults) return;
    const row = gridResultRows.get(gridCellId(result));
    if (row && !await updateGridModis(result, row.modis)) unavailable += 1;
    completed += 1;
    status.textContent = `MODIS top-ten requests: ${completed}/${results.length} cells processed.`;
  }
  if (gridScanResults !== activeResults) return;
  button.disabled = false;
  status.textContent =
    `Finished top-ten MODIS requests: ${results.length - unavailable} available, ` +
    `${unavailable} unavailable. Samples are point-area context, not tile means or ranking inputs.`;
}

function exportTopGridSites() {
  const sites = gridScanResults.slice(0, 10).map((result, index) => ({
    id: gridCellId(result),
    name: `Grid candidate ${index + 1}`,
    lat: result.latitude,
    lon: result.longitude,
    score: result.score,
    temperature_c: result.temperature,
    elevation_m: result.elevation,
    slope_deg: result.slope,
    aridity: result.aridity
  }));
  const blob = new Blob([JSON.stringify(sites, null, 2)], {
    type: "application/json"
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "sites.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function renderGridResults(results) {
  gridMarkers.forEach(marker => marker.remove());
  gridMarkers = [];
  gridScanResults = results;
  gridResultRows.clear();
  $("gridResults").replaceChildren();

  results.forEach((result, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const marker = document.createElement("button");
    const power = document.createElement("p");
    const modis = document.createElement("p");
    const id = gridCellId(result);
    const coordinates = `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;

    button.type = "button";
    button.className = "grid-result";
    button.textContent = [
      `${String(index + 1).padStart(2, "0")} · ${coordinates} · ${result.score}%`,
      `${result.temperature.toFixed(1)} °C · ${Math.round(result.elevation).toLocaleString()} m · ${result.slope.toFixed(1)}° · ${result.aridity.toFixed(1)} / 10`
    ].join("\n");
    button.setAttribute(
      "aria-label",
      `Grid match ${index + 1}: ${coordinates}, ${result.score} percent match`
    );
    button.addEventListener("click", () => {
      selectGridResult(result);
    });
    power.className = "grid-result-source";
    power.textContent = "NASA POWER: waiting for top-10 lookup…";
    modis.className = "grid-result-source";
    modis.textContent = "MODIS MOD11A2: not requested; select this cell for a live sample.";

    marker.type = "button";
    marker.className =
      `marker global-marker ${index === 0 ? "global-best" : ""}`;
    marker.slot = `hotspot-grid-result-${index + 1}`;
    const position = globePosition({
      lat: result.latitude,
      lon: result.longitude
    });
    marker.dataset.position = position.position;
    marker.dataset.normal = position.normal;
    marker.dataset.visibilityAttribute = "visible";
    marker.title =
      `Grid match ${index + 1} · ${result.score}% · ` +
      `${result.temperature.toFixed(1)} °C · ` +
      `${Math.round(result.elevation).toLocaleString()} m · ` +
      `${result.slope.toFixed(1)}° slope · ${result.aridity.toFixed(1)} / 10 aridity`;
    marker.setAttribute("aria-label", marker.title);
    marker.addEventListener("click", () => {
      selectGridResult(result);
    });

    item.appendChild(button);
    item.append(power, modis);
    $("gridResults").appendChild(item);
    gridResultRows.set(id, { power, modis });
    globe.appendChild(marker);
    gridMarkers.push(marker);
  });

  $("exportTopSites").disabled = results.length === 0;
  $("loadTopTenModis").disabled = results.length === 0;
  $("topTenModisStatus").textContent =
    "Top-ten MODIS requests are opt-in: four requests per cell, processed one cell at a time; each request may take up to 90 seconds.";
  gridHasResults = results.length > 0;
  renderAnalogCatalog();
  $("gridMapHint").classList.toggle("hidden", gridHasResults);
  $("gridMapTip").textContent = gridHasResults
    ? "ⓘ Click a ranked result or map marker to inspect its location."
    : "ⓘ Run a scan to place its top matches on the globe.";
  updateRoverCandidates(results);
  if (results.length) enrichTopGridResults(results);
}

function clearGridResults() {
  gridMarkers.forEach(marker => marker.remove());
  gridMarkers = [];
  $("gridResults").replaceChildren();
  gridResultRows.clear();
  $("exportTopSites").disabled = true;
  gridHasResults = false;
  gridScanResults = [];
  selectedGridResult = null;
  $("gridClimateHeading").textContent = "Select a grid candidate";
  $("gridPowerStatus").textContent =
    "Live climatology will load when you select a candidate.";
  $("gridPowerMetrics").replaceChildren();
  $("gridPowerMetrics").classList.add("hidden");
  $("gridModisStatus").textContent =
    "Select a cell to request a live sample from two 2023 seasonal windows.";
  $("gridModisMetrics").replaceChildren();
  $("gridModisMetrics").classList.add("hidden");
  $("retryGridModis").classList.add("hidden");
  $("loadRegionalPower").disabled = true;
  $("analogRegionalCandidate").replaceChildren(
    new Option("Run a global scan first", "")
  );
  $("analogRegionalCandidate").disabled = true;
  $("regionalPowerStatus").textContent =
    "Run a scan and choose a candidate first.";
  $("regionalPowerMetrics").replaceChildren();
  $("regionalPowerMetrics").classList.add("hidden");
  $("loadRegionalPower").textContent = "LOAD REGIONAL TEMPERATURE";
  $("loadTopTenModis").disabled = true;
  $("topTenModisStatus").textContent =
    "Top-ten MODIS requests are opt-in: four requests per cell, processed one cell at a time; each request may take up to 90 seconds.";
  renderAnalogCatalog();
  $("gridMapHint").classList.remove("hidden");
  $("gridMapTip").textContent =
    "ⓘ Run a scan to place its top matches on the globe.";
  updateRoverCandidates([]);
}

const SUBSYSTEMS = {
  wheels: {
    label: "MOBILITY · WHEELS",
    title: "Terrain and mobility context",
    field: "slope",
    valueLabel: "EARTH GRID SLOPE",
    reference: "Perseverance reference: six individually driven 52.5 cm aluminum wheels, four steering motors, and rocker-bogie suspension. NASA describes a 30° terrain-avoidance operational guideline; that is a mission-specific driving guideline, not an Earth-site threshold.",
    caveat: "The candidate value is regional Earth-grid slope. It gives terrain context, not wheel traction, rock clearance, suspension load, or a safe-traverse decision.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  power: {
    label: "ENERGY · POWER",
    title: "Energy and power context",
    field: "aridity",
    compareTarget: false,
    valueLabel: "EARTH GRID ARIDITY PROXY",
    reference: "NASA reports Perseverance uses less than 200 W while driving at top speed on flat, hard ground. That operating figure is not a power-system rating or an Earth-site power budget.",
    caveat: "The candidate's aridity value is a TerraClimate water-balance dryness proxy. It is not solar irradiance, dust deposition, battery state, or rover power availability.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  thermal: {
    label: "ENVIRONMENT · THERMAL",
    title: "Climate and thermal context",
    field: "temperature",
    valueLabel: "EARTH GRID MEAN TEMP",
    reference: "NASA describes Perseverance's warm electronics box as temperature-controlled; rover health monitoring checks and adjusts internal temperatures.",
    caveat: "The candidate value is TerraClimate annual mean Earth air temperature for 2025. It is climate context, not Mars surface temperature, rover internal temperature, thermal cycling, or a component operating limit.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  electronics: {
    label: "AVIONICS · ELECTRONICS / OPTICS",
    title: "Avionics and optical context",
    field: "temperature",
    compareTarget: false,
    valueLabel: "EARTH GRID MEAN TEMP",
    reference: "NASA lists two identical Rover Compute Elements and a radiation-hardened BAE RAD750 processor rated up to 200 MHz, with 2 GB flash, 256 MB RAM, and 256 KB EEPROM.",
    caveat: "The grid temperature is an Earth climate proxy, not electronics temperature or radiation dose. The listed processor and memory are Perseverance design facts, not candidate-site measurements or a qualification assessment.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  comms: {
    label: "LINK · COMMUNICATIONS",
    title: "Communications architecture context",
    reference: "NASA describes Perseverance as scheduling communication sessions with Earth and local Mars orbiters, returning engineering, housekeeping, science telemetry, and event reports.",
    caveat: "A candidate coordinate is geographic context only. Earth-grid similarity does not represent a Mars relay link, antenna performance, contact schedule, or communications availability.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  }
};

const RISK_REVIEW_SYSTEMS = [
  {
    name: "Wheels / mobility",
    screen: (candidate, target) => candidate
      ? `Grid slope ${candidate.slope.toFixed(1)}°; target ${target.slope.toFixed(1)}° (gap ${Math.abs(candidate.slope - target.slope).toFixed(1)}°).`
      : "Scan to compare candidate grid slope with the selected target.",
    notTested: "Perseverance reference: six 52.5 cm aluminum wheels, rocker-bogie suspension, four steering motors. Earth-grid slope is regional context—not traction or traverse safety.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  {
    name: "Chassis / suspension",
    screen: candidate => candidate
      ? `Regional elevation ${candidate.elevation.toFixed(0)} m and grid slope ${candidate.slope.toFixed(1)}° (context only).`
      : "Scan to show the candidate's regional elevation and grid slope.",
    notTested: "Chassis stress, clearance, tipping margin, obstacle geometry and suspension loading."
  },
  {
    name: "Power / energy",
    screen: candidate => candidate
      ? `Earth-grid water-balance dryness proxy: ${candidate.aridity.toFixed(1)}/10.`
      : "Scan to show the candidate's Earth-grid dryness proxy.",
    notTested: "NASA reports less than 200 W while Perseverance drives at top speed on flat, hard ground. This operating figure and Earth aridity proxy do not define site power availability.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  {
    name: "Thermal",
    screen: candidate => candidate
      ? `Grid mean temperature ${candidate.temperature.toFixed(1)} °C (broad climate context).`
      : "Scan to show the candidate's TerraClimate annual mean air temperature.",
    notTested: "NASA describes a temperature-controlled warm electronics box. TerraClimate annual mean Earth air temperature is not a Mars surface or rover internal temperature.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  {
    name: "Electronics / optics",
    screen: candidate => candidate
      ? `Earth candidate annual mean air temperature: ${candidate.temperature.toFixed(1)} °C (climate context).`
      : "Scan to show candidate climate context.",
    notTested: "NASA lists two identical Perseverance Rover Compute Elements, a BAE RAD750 processor up to 200 MHz, 2 GB flash, 256 MB RAM and 256 KB EEPROM. These architecture specifications do not describe site radiation or qualify hardware for a candidate.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  {
    name: "Communications",
    screen: candidate => candidate
      ? `Selected Earth candidate: ${candidate.latitude.toFixed(2)}°, ${candidate.longitude.toFixed(2)}° (location context only).`
      : "Scan to show candidate coordinates as geographic context.",
    notTested: "NASA describes Perseverance communication sessions with Earth and local Mars orbiters, including return of engineering and science data. This architecture is not a link prediction for an Earth candidate.",
    sourceLabel: "NASA Perseverance rover components",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/"
  },
  {
    name: "Planetary materials / environment",
    screen: candidate => candidate
      ? `Earth grid candidate: ${candidate.latitude.toFixed(2)}°, ${candidate.longitude.toFixed(2)}°; elevation ${candidate.elevation.toFixed(0)} m, slope ${candidate.slope.toFixed(1)}°, temperature ${candidate.temperature.toFixed(1)} °C, aridity ${candidate.aridity.toFixed(1)}/10.`
      : "Scan to show the candidate's four source-backed Earth-grid fields.",
    notTested: "These four Earth fields do not describe lunar or Martian mineralogy, regolith, ice, pressure, radiation, or geological activity."
  }
];

function updateRoverCandidates(results) {
  const picker = $("roverCandidate");
  if (!picker) return;
  const previous = picker.value;
  picker.replaceChildren();

  if (!results.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Scan the grid first";
    picker.appendChild(option);
    picker.disabled = true;
    updateRiskReviewCandidates([]);
    renderSubsystemReport();
    return;
  }

  results.forEach((result, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent =
      `#${String(index + 1).padStart(2, "0")} · ` +
      `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}° · ` +
      `${result.score}% match`;
    picker.appendChild(option);
  });
  picker.disabled = false;
  const previousIndex = previous === "" ? -1 : Number(previous);
  const selectedIndex =
    Number.isInteger(previousIndex) && results[previousIndex] ? previous : "0";
  picker.value = selectedIndex;
  updateRiskReviewCandidates(results, selectedIndex);
  renderSubsystemReport();
}

function updateRiskReviewCandidates(results, selectedIndex = "0") {
  const picker = $("riskReviewCandidate");
  if (!picker) return;
  picker.replaceChildren();

  if (!results.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Scan the grid first";
    picker.appendChild(option);
    picker.disabled = true;
    renderRiskReview();
    return;
  }

  results.forEach((result, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = index === 0
      ? `Best overall match · #01 · ${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`
      : `Candidate #${String(index + 1).padStart(2, "0")} · ${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    picker.appendChild(option);
  });
  picker.disabled = false;
  picker.value = selectedIndex;
  renderRiskReview();
}

function roverCandidate() {
  const value = $("roverCandidate").value;
  if (value === "") return null;
  const index = Number(value);
  return Number.isInteger(index) ? gridScanResults[index] : null;
}

function showSubsystemMetrics(rows) {
  const list = $("subsystemMetrics");
  list.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "subsystem-metric";
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.appendChild(row);
  });
}

function renderSubsystemReport() {
  renderRiskReview();
  const subsystem = SUBSYSTEMS[selectedSubsystem];
  const candidate = roverCandidate();
  const target = gridTarget();
  $("subsystemLabel").textContent = subsystem.label;
  $("subsystemTitle").textContent = subsystem.title;
  $("coverageValue").textContent =
    candidate
      ? "Earth candidate + NASA design reference"
      : "NASA design reference · scan for Earth candidate";
  $("subsystemReference").textContent = subsystem.reference;
  $("subsystemCaveat").textContent = subsystem.caveat;
  const missionSource = $("subsystemSource");
  missionSource.href = subsystem.sourceUrl;
  missionSource.textContent = `${subsystem.sourceLabel} ↗`;

  const gridSource = $("subsystemGridSource");
  const gridSources = {
    temperature: {
      label: "TerraClimate 2025 air-temperature source ↗",
      url: "https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE"
    },
    aridity: {
      label: "TerraClimate 2025 precipitation / PET source ↗",
      url: "https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE"
    },
    slope: {
      label: "WorldClim 2.1 elevation source used for slope ↗",
      url: "https://www.worldclim.org/data/worldclim21.html"
    }
  };
  const gridCitation = gridSources[subsystem.field];
  gridSource.classList.toggle("hidden", !gridCitation);
  if (gridCitation) {
    gridSource.href = gridCitation.url;
    gridSource.textContent = gridCitation.label;
  }

  const metrics = [[
    "GRID CANDIDATE",
    candidate
      ? `${candidate.latitude.toFixed(2)}°, ${candidate.longitude.toFixed(2)}°`
      : "Run a scan to add Earth-grid context"
  ]];
  if (subsystem.field && gridScoreScales?.[subsystem.field]) {
    const field = subsystem.field;
    const display = field === "temperature"
      ? value => `${value.toFixed(1)} °C`
      : field === "elevation"
        ? value => `${Math.round(value).toLocaleString()} m`
        : field === "slope"
          ? value => `${value.toFixed(1)}°`
          : value => `${value.toFixed(1)} / 10`;
    metrics.push(["EARTH GRID FIELD", field]);
    if (candidate) {
      metrics.push([subsystem.valueLabel, display(candidate[field])]);
      if (subsystem.compareTarget !== false) {
        metrics.push(["SEARCH TARGET", display(target[field])]);
        const gap = Math.abs(target[field] - candidate[field]);
        const normalizedGap = gap / gridScoreScales[field];
        metrics.push(["RELATIVE GRID SIMILARITY · NOT RISK", `${Math.round(100 / (1 + normalizedGap))}%`]);
      }
    }
  }
  showSubsystemMetrics(metrics);
}

function renderRiskReview() {
  const best = gridScanResults[0];
  const reviewIndex = Number($("riskReviewCandidate")?.value ?? 0);
  const candidate = Number.isInteger(reviewIndex)
    ? gridScanResults[reviewIndex] ?? null
    : null;
  const bestMatch = $("riskBestMatch");
  const bestScore = $("riskBestMatchScore");
  const context = $("riskReviewContext");

  bestMatch.textContent = best
    ? `#01 · ${best.latitude.toFixed(2)}°, ${best.longitude.toFixed(2)}°`
    : "Run a grid scan to find candidates.";
  bestScore.textContent = best
    ? `${best.score}% relative match to the current search`
    : "No result yet";

  context.textContent = candidate
    ? `Reviewing ${reviewIndex === 0 ? "the best overall grid match" : `candidate #${String(reviewIndex + 1).padStart(2, "0")}`} at ${candidate.latitude.toFixed(2)}°, ${candidate.longitude.toFixed(2)}°.`
    : "The best overall match is based on the current grid search criteria. Choose another scan candidate above to inspect that analog instead.";

  const rows = $("riskReviewRows");
  if (!rows) return;
  rows.replaceChildren();
  const target = gridTarget();
  RISK_REVIEW_SYSTEMS.forEach(system => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = system.name;
    const screen = document.createElement("td");
    screen.textContent = system.screen(candidate, target);
    const interpretation = document.createElement("td");
    interpretation.textContent = system.notTested;
    if (system.sourceUrl) {
      const citation = document.createElement("a");
      citation.href = system.sourceUrl;
      citation.target = "_blank";
      citation.rel = "noopener noreferrer";
      citation.textContent = system.sourceLabel;
      const citationCell = document.createElement("span");
      citationCell.append(document.createElement("br"), citation);
      interpretation.appendChild(citationCell);
    }
    row.append(name, screen, interpretation);
    rows.appendChild(row);
  });
}

function renderAnalogCatalog() {
  const container = $("analogsCatalog");
  if (!container) return;
  container.replaceChildren();

  const regionalSelect = $("analogRegionalCandidate");
  regionalSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = gridScanResults.length
    ? "Choose a ranked candidate"
    : "Run a global scan first";
  regionalSelect.appendChild(placeholder);
  gridScanResults.forEach((result, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent =
      `#${String(index + 1).padStart(2, "0")} · ` +
      `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    regionalSelect.appendChild(option);
  });
  const selectedIndex = selectedGridResult
    ? gridScanResults.findIndex(
      result => gridCellId(result) === gridCellId(selectedGridResult)
    )
    : -1;
  if (selectedIndex >= 0) {
    regionalSelect.value = String(selectedIndex);
  }
  regionalSelect.disabled = gridScanResults.length === 0;
  $("loadRegionalPower").disabled = selectedIndex < 0;

  if (!gridScanResults.length) {
    const card = document.createElement("article");
    card.className = "catalog-notice";
    card.textContent = "Run a global scan to rank the 20 closest source-backed grid cells. These are data-derived candidates, not verified or named analog sites.";
    container.appendChild(card);
    return;
  }

  gridScanResults.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "analog-card";
    const eyebrow = document.createElement("small");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = `GRID CANDIDATE · ${String(index + 1).padStart(2, "0")}`;
    const heading = document.createElement("h2");
    heading.textContent =
      `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    const environment = document.createElement("strong");
    environment.textContent = `${result.score}% relative similarity`;
    const description = document.createElement("p");
    description.textContent =
      `${result.temperature.toFixed(1)} °C · ${Math.round(result.elevation).toLocaleString()} m · ` +
      `${result.slope.toFixed(1)}° slope · ${result.aridity.toFixed(1)}/10 aridity`;
    const action = document.createElement("button");
    action.className = "secondary-action";
    action.type = "button";
    action.textContent = "INSPECT ON GLOBE →";
    action.addEventListener("click", () => {
      regionalSelect.value = String(index);
      regionalSelect.dispatchEvent(new Event("change"));
      showPage("atlasView");
      focusSite({ lat: result.latitude, lon: result.longitude });
      $("coordinates").textContent =
        `GRID CELL · ${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    });
    card.append(eyebrow, heading, environment, description, action);
    container.appendChild(card);
  });
}

function appendCuratedParameters(container, parameters) {
  const list = document.createElement("dl");
  list.className = "curated-profile-parameters";
  parameters.forEach(parameter => {
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = parameter.name;
    value.textContent = parameter.value;
    if (parameter.sourceUrl) {
      const source = document.createElement("a");
      source.href = parameter.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = parameter.sourceTitle || "Open cited source";
      value.append(document.createElement("br"), source);
    }
    list.append(term, value);
  });
  container.appendChild(list);
}

function renderCuratedProfile(profile) {
  const article = $("curatedProfileDetails");
  article.replaceChildren();
  if (!profile) {
    selectedCuratedProfileId = null;
    article.classList.add("hidden");
    return;
  }
  selectedCuratedProfileId = profile.id;

  const heading = document.createElement("h3");
  heading.textContent = `${profile.body} · ${profile.name}`;
  const summary = document.createElement("p");
  const sourceScope = profile.body === "Moon"
    ? "Profile-level citations are provided by the workbook; fields are not individually cited."
    : "Each included field has a row-level source link.";
  summary.textContent =
    `${profile.terrainTypes.join(" · ")} · ` +
    `${profile.parameters.length} workbook-labeled measured reference fields. ` +
    `${sourceScope} Selecting it does not change the scan or its parameters.`;
  article.append(heading, summary);

  const firstParameters = profile.parameters.slice(0, 5);
  appendCuratedParameters(article, firstParameters);
  if (profile.parameters.length > firstParameters.length) {
    const more = document.createElement("details");
    const moreSummary = document.createElement("summary");
    moreSummary.textContent =
      `Show ${profile.parameters.length - firstParameters.length} more cited fields`;
    more.appendChild(moreSummary);
    appendCuratedParameters(more, profile.parameters.slice(firstParameters.length));
    article.appendChild(more);
  }

  const sourcesPanel = document.createElement("details");
  sourcesPanel.id = "curatedProfileSourcesPanel";
  const sourcesSummary = document.createElement("summary");
  sourcesSummary.textContent = `Show ${profile.sources.length} profile citations`;
  const sourceNote = document.createElement("p");
  sourceNote.className = "curated-profile-source-note";
  sourceNote.textContent = profile.sourceNote ??
    "Sources are retained from the workbook and have not been independently revalidated.";
  const sources = document.createElement("ul");
  profile.sources.forEach(item => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title || item.url;
    listItem.appendChild(link);
    sources.appendChild(listItem);
  });
  sourcesPanel.append(sourcesSummary, sourceNote, sources);
  article.appendChild(sourcesPanel);
  article.classList.remove("hidden");
}

function renderCuratedProfileList() {
  const search = $("curatedProfileSearch").value.trim().toLocaleLowerCase();
  const body = $("curatedProfileBody").value;
  const filtered = curatedProfiles.filter(profile =>
    (body === "all" || profile.body === body) &&
    `${profile.name} ${profile.terrainTypes.join(" ")}`.toLocaleLowerCase().includes(search)
  );
  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / CURATED_PROFILES_PER_PAGE)
  );
  curatedProfilePage = Math.min(curatedProfilePage, pageCount - 1);
  const start = curatedProfilePage * CURATED_PROFILES_PER_PAGE;
  const pageProfiles = filtered.slice(start, start + CURATED_PROFILES_PER_PAGE);
  const list = $("curatedProfileList");
  list.replaceChildren();

  pageProfiles.forEach(profile => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "curated-profile-choice";
    button.classList.toggle("active", profile.id === selectedCuratedProfileId);
    button.textContent = profile.name;
    button.setAttribute("aria-pressed", String(
      profile.id === selectedCuratedProfileId
    ));
    button.addEventListener("click", () => {
      renderCuratedProfile(profile);
      renderCuratedProfileList();
    });
    list.appendChild(button);
  });

  $("curatedProfilePageStatus").textContent = filtered.length
    ? `${start + 1}–${Math.min(start + pageProfiles.length, filtered.length)} of ${filtered.length}`
    : "No matching profiles";
  $("curatedProfilePrevious").disabled = curatedProfilePage === 0;
  $("curatedProfileNext").disabled = curatedProfilePage >= pageCount - 1;
  $("curatedProfileStatus").textContent =
    `${curatedProfiles.length} named reference profiles · 20 shown per page. ` +
    "Workbook labels and citations have not been independently revalidated.";
}

async function loadCuratedProfiles() {
  if (curatedProfilesLoad) return curatedProfilesLoad;
  const status = $("curatedProfileStatus");
  curatedProfilesLoad = (async () => {
    try {
      const response = await fetch("./assets/curated_reference_profiles.json");
      if (!response.ok) {
        throw new Error(
          `Curated profile data request failed (HTTP ${response.status}).`
        );
      }
      const data = await response.json();
      if (
        data?.schemaVersion !== 1 ||
        !Array.isArray(data.profiles) ||
        data.profiles.length === 0 ||
        !data.profiles.every(profile =>
          typeof profile.id === "string" &&
          typeof profile.name === "string" &&
          ["Moon", "Mars"].includes(profile.body) &&
          Array.isArray(profile.terrainTypes) &&
          Array.isArray(profile.parameters) &&
          profile.parameters.every(parameter =>
            typeof parameter.name === "string" &&
            typeof parameter.value === "string"
          ) &&
          Array.isArray(profile.sources) &&
          profile.sources.every(source =>
            typeof source.title === "string" &&
            typeof source.url === "string" &&
            source.url.startsWith("https://")
          )
        )
      ) {
        throw new Error("Curated profile data has an unsupported or empty format.");
      }
      curatedProfiles = data.profiles;
      $("curatedProfileSearch").disabled = false;
      $("curatedProfileBody").disabled = false;
      const counts = curatedProfiles.reduce((result, profile) => {
        result[profile.body] = (result[profile.body] || 0) + 1;
        return result;
      }, {});
      status.textContent =
        `${curatedProfiles.length} named profiles loaded ` +
        `(${counts.Mars || 0} Mars, ${counts.Moon || 0} Moon).`;
      renderCuratedProfileList();

      const excludedList = $("curatedProfileExclusions");
      excludedList.replaceChildren();
      (data.excludedWorkbooks || []).forEach(item => {
        const entry = document.createElement("li");
        entry.textContent = `${item.file}: ${item.reason}`;
        excludedList.appendChild(entry);
      });
      if (data.excludedWorkbooks?.length) {
        const note = document.createElement("li");
        note.textContent =
          "These excluded values do not appear in the profile picker or global scan.";
        excludedList.appendChild(note);
      }
      return true;
    } catch (error) {
      curatedProfilesLoad = null;
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Curated profiles unavailable: ${message}`;
      console.error("Could not load curated source profiles.", error);
      return false;
    }
  })();
  return curatedProfilesLoad;
}

function renderGridMetadata(metadata) {
  const summary = $("gridMetadataSummary");
  const sourceList = $("gridSourceList");
  if (!summary || !sourceList) return;

  const resolutionKm = metadata.resolutionMeters / 1000;
  const nasa = metadata.nasaLayerCoverage ?? {};
  const nasaCells = [
    ["MODIS MOD11A2 temperature", nasa.modisTemperatureCells ?? 0],
    ["NASADEM elevation", nasa.nasademElevationCells ?? 0],
    ["NASADEM slope", nasa.nasademSlopeCells ?? 0]
  ];
  const activeNasa = nasaCells.filter(([, count]) => count > 0);
  summary.textContent =
    `${metadata.count.toLocaleString()} source-covered land cells · ` +
    `approximately ${resolutionKm.toFixed(0)} km equal-area · ` +
    `${metadata.sourcePeriod}. ` +
    (activeNasa.length
      ? `NASA layer coverage: ${activeNasa.map(([name, count]) =>
        `${name} ${Number(count).toLocaleString()} cells`
      ).join(", ")}.`
      : "No NASADEM or MODIS layers are active in the checked-in ranking grid.");

  sourceList.replaceChildren();
  metadata.citations.forEach(citation => {
    const item = document.createElement("li");
    item.textContent = citation;
    sourceList.appendChild(item);
  });
  if (!metadata.citations.length) {
    const item = document.createElement("li");
    item.textContent = "The active grid metadata does not include source citations.";
    sourceList.appendChild(item);
  }
}

function showPage(pageId, updateHistory = true) {
  const views = document.querySelectorAll(".page-view");
  views.forEach(view => {
    const active = view.id === pageId;
    view.classList.toggle("hidden", !active);
    if (active) view.removeAttribute("hidden");
    else view.setAttribute("hidden", "");
  });

  document.querySelectorAll(".site-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const isAppPage = pageId === "atlasView" || pageId === "roverView";
  $("moonBtn").closest(".modes").classList.toggle("hidden", !isAppPage);
  document.body.dataset.page = pageId;

  if (updateHistory) {
    const slug = pageId.replace("View", "").toLowerCase();
    history.replaceState(null, "", `${location.pathname}${location.search}#${slug}`);
  }

  if (pageId === "roverView") renderSubsystemReport();
}

function initGridSearch() {
  try {
    gridWorker = new Worker("./searchWorker.js");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    $("gridSearchStatus").textContent =
      `Could not start the search worker: ${message}. Serve this page over HTTP.`;
    console.error("Could not start the global grid worker.", error);
    return;
  }

  gridWorker.addEventListener("message", event => {
    const { type, message } = event.data;
    if (type === "READY") {
      gridReady = true;
      gridScoreScales = event.data.scoreScales;
      const temperatureDefinition =
        event.data.temperatureDefinition ??
        "TerraClimate annual mean air temperature in degrees Celsius.";
      const elevationDefinition =
        event.data.elevationDefinition ?? "WorldClim 2.1 elevation.";
      const slopeMethod =
        event.data.slopeMethod ?? "Elevation-derived regional slope.";
      const usesModis = temperatureDefinition.includes("MODIS");
      $("gridTemperatureLabel").textContent = usesModis
        ? temperatureDefinition.includes("TerraClimate")
          ? "MIXED LST / AIR-TEMP PROXY"
          : "MODIS LAND-SURFACE TEMPERATURE"
        : "MEAN AIR TEMPERATURE";
      $("matrixTemperatureSource").textContent = temperatureDefinition;
      $("matrixElevationSource").textContent = elevationDefinition;
      $("matrixSlopeSource").textContent = slopeMethod;
      $("gridSearchBtn").disabled = false;
      const coverage = event.data.latitudeCoverage;
      $("gridSearchStatus").textContent =
        `Grid ready · ${event.data.count.toLocaleString()} source-covered land tiles · ` +
        `${(event.data.resolutionMeters / 1000).toFixed(0)} km equal-area · ` +
        `${event.data.sourcePeriod} climate snapshot · latitude ` +
        `${coverage.minimum.toFixed(1)} to ${coverage.maximum.toFixed(1)}°.`;
      const coverageNote =
        `Coverage: source-complete land cells between ${coverage.minimum.toFixed(1)}° ` +
        `and ${coverage.maximum.toFixed(1)} latitude; cells with missing inputs are omitted.`;
      const nasaCoverage = event.data.nasaLayerCoverage;
      const hasNasaLayers = nasaCoverage &&
        (nasaCoverage.modisTemperatureCells > 0 ||
          nasaCoverage.nasademElevationCells > 0);
      const nasaCoverageNote = hasNasaLayers
          ? ` NASA-backed land cells in this build: MODIS LST ` +
            `${nasaCoverage.modisTemperatureCells.toLocaleString()}, NASADEM ` +
            `elevation ${nasaCoverage.nasademElevationCells.toLocaleString()}, ` +
            `NASADEM slope ${nasaCoverage.nasademSlopeCells.toLocaleString()}.`
          : "";
      $("gridDataDisclaimer").textContent = hasNasaLayers
        ? "This build includes NASA MODIS surface-temperature and NASADEM terrain layers where valid; see the source coverage and fallback details below. Results are screening candidates, not verified analogs or mission-planning data."
        : "The checked-in grid uses TerraClimate 2025 climate plus WorldClim 2.1 elevation. Rebuild with the documented NASA export to add NASA layers. Results are screening candidates, not verified analogs or mission-planning data.";
      renderGridMetadata({
        count: event.data.count,
        resolutionMeters: event.data.resolutionMeters,
        sourcePeriod: event.data.sourcePeriod,
        citations: event.data.citations,
        nasaLayerCoverage: nasaCoverage
      });
      $("gridSourceDetails").textContent = event.data.citations.length
        ? `${coverageNote}${nasaCoverageNote} Sources: ${event.data.citations.join(" · ")}`
        : `${coverageNote}${nasaCoverageNote} Source citations were not included with this grid.`;
      renderSubsystemReport();
      return;
    }

    if (type === "RESULTS") {
      $("gridSearchBtn").disabled = false;
      $("gridSearchStatus").textContent =
        `Top ${event.data.results.length} candidates from ` +
        `${event.data.validCellCount.toLocaleString()} source-covered land tiles scanned · ` +
        `${(event.data.resolutionMeters / 1000).toFixed(0)} km equal-area.`;
      renderGridResults(event.data.results);
      return;
    }

    if (type === "ERROR") {
      $("gridSearchBtn").disabled = !gridReady;
      $("gridSearchStatus").textContent = message;
      console.error("Global grid search failed:", message);
    }
  });

  gridWorker.addEventListener("error", event => {
    $("gridSearchBtn").disabled = true;
    $("gridSearchStatus").textContent =
      `Global grid worker failed: ${event.message}`;
    console.error("Global grid worker failed.", event);
  });

  gridWorker.postMessage({ type: "LOAD_DATA" });
}

function initGlobe() {
  globe = $("map");

  globe.addEventListener("load", () => {
    $("globeFallback").classList.add("hidden");
    if (selectedSite) focusSite(selectedSite);
  });

  globe.addEventListener("error", event => {
    console.error("Could not load the NASA Earth model.", event);
    $("globeFallback").classList.remove("hidden");
  });

  $("retryGlobeModel").addEventListener("click", () => {
    const modelUrl = new URL(globe.getAttribute("src"), document.baseURI);
    modelUrl.searchParams.set("retry", String(Date.now()));
    globe.src = modelUrl.href;
  });
}

function focusSite(site) {
  if (!globe.loaded) return;

  const { radius } = globe.getCameraOrbit();
  const theta = site.lon + 180;
  const phi = 90 - site.lat;
  globe.cameraOrbit =
    `${theta}deg ${phi}deg ${Math.min(radius, 950)}m`;
}

function zoomGlobe(factor) {
  if (!globe.loaded) return;

  const { theta, phi, radius } = globe.getCameraOrbit();
  const nextRadius = Math.max(620, Math.min(2500, radius * factor));
  globe.cameraOrbit = `${theta}rad ${phi}rad ${nextRadius}m`;
}

function updateMap() {
  markers.forEach(marker => marker.remove());
  markers = [];
}

function openSite(site, zoom = true, syncLatitude = true) {
  selectedSite = site;
  updateSiteUrl(site.name);
  $("sitePicker").value = site.name;
  if (syncLatitude) {
    $("sunLatitude").value = site.lat;
    updateSunCalculator(site.lat);
  }

  $("siteCard").classList.remove("hidden");
  $("siteType").textContent = site.type === "terrain"
    ? "TERRAIN ANALOG SITE"
    : "CLIMATE REFERENCE SITE";

  $("siteName").textContent = site.name;
  $("siteLocation").textContent =
    `${site.country} · ${site.lat}°, ${site.lon}°`;

  $("siteScore").textContent = `${site.score}%`;
  $("siteProgress").style.width = `${site.score}%`;

  $("siteDescription").textContent = site.description;

  const metrics = [
    ["TEMPERATURE", `${site.temperature} °C`],
    ["ALTITUDE", `${site.altitude.toLocaleString()} m`],
    ["PRESSURE", `${site.pressure} kPa`],
    ["ARIDITY", `${site.aridity} / 10`],
    ["SOIL PROFILE", `${site.soil} / 10`],
    ["ENVIRONMENT", site.climate]
  ];

  $("siteMetrics").innerHTML = metrics.map(([label, value]) => `
    <div class="metric">
      <span>${label}</span>
      <b>${value}</b>
    </div>
  `).join("");

  loadClimateData(site);

  if (zoom) {
    focusSite(site);
  }
}

function climateKey(site) {
  return `${site.lat},${site.lon}`;
}

function updateSiteUrl(siteName = null) {
  const url = new URL(window.location.href);
  if (siteName) {
    url.searchParams.set("site", siteName);
  } else {
    url.searchParams.delete("site");
  }
  window.history.replaceState(null, "", url);
}

function exportSiteJson() {
  if (!selectedSite) return;

  const site = selectedSite;
  const data = {
    name: site.name,
    country: site.country,
    latitude: site.lat,
    longitude: site.lon,
    score: site.score,
    climate: site.climate,
    description: site.description,
    nasaPower: climateCache.get(climateKey(site)) ?? null
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function renderTemperatureChart(monthlyTemperatures) {
  const chart = $("climateChart");
  const width = 360;
  const height = 150;
  const left = 32;
  const right = 8;
  const top = 12;
  const bottom = 28;
  const values = monthlyTemperatures;
  const low = Math.floor(Math.min(...values) / 5) * 5;
  const high = Math.ceil(Math.max(...values) / 5) * 5 || low + 5;
  const range = high - low || 5;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "NASA POWER monthly mean air temperature");

  const addElement = (name, attributes, text = "") => {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      name
    );
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    element.textContent = text;
    svg.appendChild(element);
    return element;
  };

  addElement("title", {}, "Monthly mean air temperature");
  addElement(
    "desc",
    {},
    "NASA POWER monthly climatology temperatures in degrees Celsius."
  );

  for (let tick = 0; tick <= 2; tick++) {
    const value = low + range * tick / 2;
    const y = top + plotHeight * (1 - tick / 2);
    addElement("line", {
      x1: left, x2: width - right, y1: y, y2: y, class: "chart-grid"
    });
    addElement("text", {
      x: left - 5, y: y + 3, "text-anchor": "end", class: "chart-axis"
    }, `${value.toFixed(0)}°`);
  }

  const points = values.map((value, index) => {
    const x = left + plotWidth * index / (values.length - 1);
    const y = top + plotHeight * (1 - (value - low) / range);
    return { x, y, value };
  });

  addElement("polyline", {
    points: points.map(point => `${point.x},${point.y}`).join(" "),
    class: "chart-line"
  });

  points.forEach((point, index) => {
    const x = left + plotWidth * index / (values.length - 1);
    const circle = addElement("circle", {
      cx: point.x, cy: point.y, r: 2.5, class: "chart-point"
    });
    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "title"
    );
    title.textContent = `${MONTHS[index][1]}: ${point.value.toFixed(1)} °C`;
    circle.appendChild(title);
    addElement("text", {
      x, y: height - 8, "text-anchor": "middle", class: "chart-month"
    }, MONTHS[index][1]);
  });

  const label = document.createElement("p");
  label.textContent = "MONTHLY MEAN AIR TEMPERATURE · °C";
  chart.replaceChildren(label, svg);
  chart.classList.remove("hidden");
}

function renderClimateData(data) {
  $("climateStatus").textContent =
    "NASA POWER grid-cell averages; local conditions may differ.";
  $("refreshClimate").classList.add("hidden");

  const metrics = [
    ["2 M AIR TEMP", `${data.temperature.toFixed(1)} °C`],
    ["WIND SPEED", `${data.windSpeed.toFixed(1)} m/s`],
    ["SOLAR RADIATION", `${data.solarRadiation.toFixed(2)} kWh/m²/day`]
  ];

  $("climateMetrics").innerHTML = metrics.map(([label, value]) => `
    <div class="metric">
      <span>${label}</span>
      <b>${value}</b>
    </div>
  `).join("");
  $("climateMetrics").classList.remove("hidden");
  renderTemperatureChart(data.monthlyTemperature);
}

async function requestClimateData(site) {
  const url = new URL(
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
  );
  url.search = new URLSearchParams({
    parameters: "T2M,WS2M,ALLSKY_SFC_SW_DWN",
    community: "AG",
    longitude: String(site.lon),
    latitude: String(site.lat),
    format: "JSON"
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NASA POWER request failed with status ${response.status}.`);
  }

  const result = await response.json();
  const parameters = result?.properties?.parameter;
  const values = [
    parameters?.T2M?.ANN,
    parameters?.WS2M?.ANN,
    parameters?.ALLSKY_SFC_SW_DWN?.ANN
  ];
  const monthlyTemperature = MONTHS.map(([key]) => parameters?.T2M?.[key]);

  const isValidValue = value =>
    typeof value === "number" && Number.isFinite(value) && value !== -999;
  if (values.some(value => !isValidValue(value)) ||
      monthlyTemperature.some(value => !isValidValue(value))) {
    throw new Error("NASA POWER returned incomplete climatology data.");
  }

  return {
    temperature: values[0],
    windSpeed: values[1],
    solarRadiation: values[2],
    monthlyTemperature
  };
}

function loadClimateData(site, forceRefresh = false) {
  const key = climateKey(site);
  if (!forceRefresh && climateCache.has(key)) {
    activeClimateKey = key;
    climateRequestId++;
    renderClimateData(climateCache.get(key));
    return;
  }
  if (key === activeClimateKey && !forceRefresh) return;

  activeClimateKey = key;
  const requestId = ++climateRequestId;
  const climateMetrics = $("climateMetrics");
  const climateChart = $("climateChart");
  const climateStatus = $("climateStatus");
  const refreshButton = $("refreshClimate");
  climateMetrics.classList.add("hidden");
  climateChart.classList.add("hidden");
  refreshButton.classList.add("hidden");

  climateStatus.textContent = "Loading NASA POWER climate data...";

  requestClimateData(site)
    .then(data => {
      climateCache.set(key, data);
      if (requestId !== climateRequestId ||
          !selectedSite ||
          climateKey(selectedSite) !== key) {
        return;
      }

      renderClimateData(data);
    })
    .catch(error => {
      console.error("Could not load NASA POWER climate data.", error);
      if (requestId !== climateRequestId ||
          !selectedSite ||
          climateKey(selectedSite) !== key) {
        return;
      }

      climateStatus.textContent =
        "Climate data unavailable. Check your connection and retry.";
      refreshButton.classList.remove("hidden");
    });
}

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;

  $("moonBtn").classList.toggle("active", mode === "moon");
  $("marsBtn").classList.toggle("active", mode === "mars");

  $("modeTitle").textContent =
    mode === "moon" ? "Moon analogs" : "Mars analogs";

  $("planetIcon").textContent = mode === "moon" ? "☾" : "♂";

  $("modeDescription").textContent =
    mode === "mars"
    ? "Set Earth-side requirements or select a Mars region to seed available temperature and elevation targets. MOLA slope is reference-only because its pixel baseline differs from the Earth grid."
      : "Set Earth-side requirements and scan the Earth grid. NASA lunar raster measurements are not yet integrated, so Moon mode is context-only.";

  document.documentElement.style.setProperty(
    "--accent",
    mode === "moon" ? "#facc15" : "#fb7185"
  );

  updateSunCalculator(Number($("sunLatitude").value));
  updateMap();
}

$("moonBtn").addEventListener("click", () => setMode("moon"));
$("marsBtn").addEventListener("click", () => setMode("mars"));

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll(".subsystem-tabs [data-subsystem], .rover-hotspot")
  .forEach(button => {
    button.addEventListener("click", () => {
      selectedSubsystem = button.dataset.subsystem;
      document.querySelectorAll(".subsystem-tabs [data-subsystem]")
        .forEach(tab => tab.classList.toggle(
          "active",
          tab.dataset.subsystem === selectedSubsystem
        ));
      renderSubsystemReport();
    });
  });

$("riskManagementButton").addEventListener("click", event => {
  const button = event.currentTarget;
  const panel = $("riskManagementPanel");
  const expanded = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded
    ? "CLOSE SUBSYSTEM REFERENCE"
    : "OPEN SUBSYSTEM REFERENCE";
  panel.classList.toggle("hidden", !expanded);
  if (expanded) renderRiskReview();
});

$("roverCandidate").addEventListener("change", () => {
  $("riskReviewCandidate").value = $("roverCandidate").value;
  renderSubsystemReport();
});
$("riskReviewCandidate").addEventListener("change", () => {
  $("roverCandidate").value = $("riskReviewCandidate").value;
  renderSubsystemReport();
});
$("roverPreset").addEventListener("change", () => {
  $("roverPresetNote").textContent =
    $("roverPreset").value === "perseverance"
      ? "NASA facts describe Perseverance and are independent of the displayed model. This preset changes the engineering reference, not the model."
      : "Lunar-scout framing is conceptual; cited quantitative design facts remain Perseverance references. The displayed model is a visual aid, not a lunar vehicle design.";
});

const roverModel = $("roverModel");
const roverModelFallback = $("roverModelFallback");

function changeRoverOrbit(thetaDelta, phi = null) {
  if (!roverModel.loaded) return;
  const orbit = roverModel.getCameraOrbit();
  const nextTheta = orbit.theta + thetaDelta;
  const nextPhi = phi === null ? orbit.phi : phi;
  roverModel.setAttribute(
    "camera-orbit",
    `${nextTheta}rad ${nextPhi}rad ${orbit.radius}m`
  );
}

$("roverViewLeft").addEventListener("click", () => {
  changeRoverOrbit(-Math.PI / 4);
});

$("roverViewRight").addEventListener("click", () => {
  changeRoverOrbit(Math.PI / 4);
});

$("roverViewTop").addEventListener("click", () => {
  changeRoverOrbit(0, 0.12);
});

$("roverViewReset").addEventListener("click", () => {
  if (roverModel.loaded) {
    roverModel.setAttribute("camera-orbit", "35deg 70deg 5m");
  }
});

$("roverAutoRotate").addEventListener("click", event => {
  const button = event.currentTarget;
  const enabled = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(enabled));
  roverModel.toggleAttribute("auto-rotate", enabled);
});

roverModel.addEventListener("error", () => {
  roverModelFallback.classList.remove("hidden");
});

roverModel.addEventListener("load", () => {
  roverModelFallback.classList.add("hidden");
  roverModel.setAttribute("camera-controls", "");
});

$("retryRoverModel").addEventListener("click", () => {
  const modelUrl = new URL(roverModel.getAttribute("src"), document.baseURI);
  modelUrl.searchParams.set("retry", String(Date.now()));
  roverModel.src = modelUrl.href;
});

$("showAllBtn").addEventListener("click", () => {
  globe.cameraTarget = "0m 0m 0m";
  globe.cameraOrbit = "0deg 75deg 1500m";
});

$("zoomInBtn").addEventListener("click", () => zoomGlobe(0.82));
$("zoomOutBtn").addEventListener("click", () => zoomGlobe(1.22));

$("sunLatitude").addEventListener("input", () => {
  updateSunCalculator(Number($("sunLatitude").value));
});

[
  ["gridTemperature", "gridTemperatureValue", value => `${value} °C`],
  ["gridElevation", "gridElevationValue", value => `${Number(value).toLocaleString()} m`],
  ["gridSlope", "gridSlopeValue", value => `${value}°`],
  ["gridAridity", "gridAridityValue", value => `${value} / 10`]
].forEach(([inputId, outputId, format]) => {
  $(inputId).addEventListener("input", () => {
    $(outputId).textContent = format($(inputId).value);
    const matrixOutput = $(`matrix${inputId.slice(4)}Target`);
    if (matrixOutput) matrixOutput.textContent = format($(inputId).value);
    if (gridHasResults) {
      clearGridResults();
      $("gridSearchStatus").textContent =
        "Requirements changed. Scan again to refresh the results.";
    }
  });
});

[
  "Temperature",
  "Elevation",
  "Slope",
  "Aridity"
].forEach(label => {
  const weight = $(`weight${label}`);
  weight.addEventListener("input", () => {
    $(`weight${label}Value`).textContent = `${weight.value}×`;
    if (gridHasResults) {
      clearGridResults();
      $("gridSearchStatus").textContent =
        "Parameter weights changed. Scan again to refresh the results.";
    }
  });
});

$("gridSearchBtn").addEventListener("click", () => {
  if (!gridReady || !gridWorker) return;

  const target = gridTarget();
  if (Object.values(target.weights).every(weight => weight === 0)) {
    $("gridSearchStatus").textContent =
      "Set at least one parameter weight above zero before scanning.";
    return;
  }
  clearGridResults();
  $("gridSearchBtn").disabled = true;
  $("gridSearchStatus").textContent =
    "Scanning the land tiles in the background…";
  gridWorker.postMessage({ type: "SCAN", target });
});

$("exportTopSites").addEventListener("click", exportTopGridSites);
$("browseCuratedProfiles").addEventListener("click", () => {
  showPage("analogsView");
  $("curatedProfilePanel").open = true;
  if (!curatedProfilesLoad) loadCuratedProfiles();
  $("curatedProfilePanel").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("curatedProfilePanel").addEventListener("toggle", event => {
  if (event.currentTarget.open && !curatedProfilesLoad) loadCuratedProfiles();
});
$("curatedProfileSearch").addEventListener("input", () => {
  curatedProfilePage = 0;
  renderCuratedProfileList();
});
$("curatedProfileBody").addEventListener("change", () => {
  curatedProfilePage = 0;
  renderCuratedProfileList();
});
$("curatedProfilePrevious").addEventListener("click", () => {
  curatedProfilePage = Math.max(0, curatedProfilePage - 1);
  renderCuratedProfileList();
});
$("curatedProfileNext").addEventListener("click", () => {
  curatedProfilePage += 1;
  renderCuratedProfileList();
});
$("analogRegionalCandidate").addEventListener("change", event => {
  const result = gridScanResults[Number(event.currentTarget.value)];
  selectedGridResult = result || null;
  $("loadRegionalPower").disabled = !result;
  $("regionalPowerMetrics").replaceChildren();
  $("regionalPowerMetrics").classList.add("hidden");
  $("loadRegionalPower").textContent = "LOAD REGIONAL TEMPERATURE";
  $("regionalPowerStatus").textContent = result
    ? `Selected candidate · ${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°. Load the optional 2° × 2° NASA POWER neighborhood context.`
    : "Choose a candidate from the latest scan first.";
});
$("loadRegionalPower").addEventListener("click", loadRegionalPowerContext);
$("retryGridPower").addEventListener("click", () => {
  if (selectedGridResult) {
    updateGridPower(selectedGridResult, $("gridPowerStatus"), true);
  }
});
$("retryGridModis").addEventListener("click", () => {
  if (selectedGridResult) {
    updateGridModis(selectedGridResult, $("gridModisStatus"), true);
  }
});
$("loadTopTenModis").addEventListener("click", loadModisForTopTen);

initGlobe();
updateSunCalculator(Number($("sunLatitude").value));
updateMap();
initGridSearch();
renderAnalogCatalog();
updateRoverCandidates([]);

const requestedPage = location.hash.slice(1).toLowerCase();
const pageId = [...document.querySelectorAll(".page-view")]
  .find(view => view.id.replace("View", "").toLowerCase() === requestedPage)?.id;
if (pageId) showPage(pageId, false);
