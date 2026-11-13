
const FILTERS = [
  {
    id: "temperature",
    label: "Temperature",
    unit: "°C",
    min: -100,
    max: 60,
    moon: -5,
    mars: -10
  },
  {
    id: "altitude",
    label: "Altitude",
    unit: "m",
    min: -500,
    max: 5000,
    moon: 1200,
    mars: 1800
  },
  {
    id: "pressure",
    label: "Pressure",
    unit: "kPa",
    min: 0,
    max: 110,
    moon: 80,
    mars: 75
  },
  {
    id: "aridity",
    label: "Aridity",
    unit: "/10",
    min: 0,
    max: 10,
    moon: 9,
    mars: 8
  },
  {
    id: "soil",
    label: "Soil profile",
    unit: "/10",
    min: 0,
    max: 10,
    moon: 7,
    mars: 9
  }
];

const LOW_LIGHT_THRESHOLD = 10;
const EARTH_OBLIQUITY = 23.44;
const MARS_OBLIQUITY = 25.19;
const MONTHS = [
  ["JAN", "Jan"], ["FEB", "Feb"], ["MAR", "Mar"], ["APR", "Apr"],
  ["MAY", "May"], ["JUN", "Jun"], ["JUL", "Jul"], ["AUG", "Aug"],
  ["SEP", "Sep"], ["OCT", "Oct"], ["NOV", "Nov"], ["DEC", "Dec"]
];

const SITES = [
  {
    name: "Atacama Desert",
    country: "Northern Chile",
    lat: -23.6, lon: -68.2,
    temperature: 18, altitude: 2400,
    pressure: 75, aridity: 10, soil: 8,
    type: "terrain",
    climate: "Hyper-arid desert",
    description:
      "An exceptionally dry region with salt flats, exposed rock and mineral-rich soils. A useful environment for Mars-analog field studies."
  },
  {
    name: "McMurdo Dry Valleys",
    country: "Antarctica",
    lat: -77.5, lon: 162,
    temperature: -20, altitude: 1200,
    pressure: 88, aridity: 9, soil: 9,
    type: "terrain",
    climate: "Cold desert",
    description:
      "Cold, exposed valleys with very little precipitation, rocky surfaces and permafrost. Frequently studied as a Mars analog."
  },
  {
    name: "Icelandic Lava Fields",
    country: "Iceland",
    lat: 64.9, lon: -19.1,
    temperature: 3, altitude: 500,
    pressure: 95, aridity: 5, soil: 7,
    type: "terrain",
    climate: "Volcanic terrain",
    description:
      "Basaltic lava, volcanic rocks and sparse vegetation provide examples of rocky planetary surface materials."
  },
  {
    name: "Haughton Crater",
    country: "Devon Island, Canada",
    lat: 75.4, lon: -89.7,
    temperature: -15, altitude: 250,
    pressure: 98, aridity: 7, soil: 6,
    type: "terrain",
    climate: "Polar desert",
    description:
      "A remote impact crater in a polar desert environment, useful for planetary field simulations."
  },
  {
    name: "Teide Volcanic Terrain",
    country: "Tenerife, Canary Islands",
    lat: 28.27, lon: -16.64,
    temperature: 10, altitude: 2200,
    pressure: 78, aridity: 6, soil: 7,
    type: "terrain",
    climate: "High-altitude volcanic",
    description:
      "High-elevation volcanic slopes with ash, lava and exposed rock."
  },
  {
    name: "Namib Desert",
    country: "Namibia",
    lat: -24.7, lon: 15.3,
    temperature: 20, altitude: 600,
    pressure: 94, aridity: 9, soil: 7,
    type: "terrain",
    climate: "Coastal desert",
    description:
      "An ancient desert with large dune systems, gravel plains and extremely dry conditions."
  },
  {
    name: "Mauna Kea",
    country: "Hawaii, United States",
    lat: 19.82, lon: -155.47,
    temperature: 2, altitude: 4205,
    pressure: 60, aridity: 7, soil: 6,
    type: "terrain",
    climate: "High-altitude volcanic",
    description:
      "High volcanic terrain with cold conditions, reduced air pressure and sparse high-elevation environments."
  },
  {
    name: "Makgadikgadi Pan",
    country: "Botswana",
    lat: -20.5, lon: 25.2,
    temperature: 24, altitude: 930,
    pressure: 91, aridity: 8, soil: 8,
    type: "terrain",
    climate: "Salt pan",
    description:
      "A broad salt-pan landscape with mineral-rich sediments and flat, exposed terrain."
  },
  {
    name: "Central Sahara",
    country: "North Africa",
    lat: 23.4, lon: 12.7,
    temperature: 29, altitude: 450,
    pressure: 96, aridity: 10, soil: 8,
    type: "climate",
    climate: "Hot desert",
    description:
      "An extensive arid region with dunes, rocky plateaus and gravel plains."
  },
  {
    name: "Tibetan Plateau",
    country: "Central Asia",
    lat: 32, lon: 88,
    temperature: -2, altitude: 4500,
    pressure: 58, aridity: 6, soil: 5,
    type: "climate",
    climate: "High-altitude plateau",
    description:
      "A vast high-altitude region with reduced atmospheric pressure and cold conditions."
  },
  {
    name: "Greenland Ice Sheet Margin",
    country: "Greenland",
    lat: 68, lon: -40,
    temperature: -12, altitude: 1000,
    pressure: 88, aridity: 6, soil: 4,
    type: "climate",
    climate: "Polar",
    description:
      "An exposed cold environment containing ice, rock and seasonally changing surface conditions."
  },
  {
    name: "Rub' al Khali",
    country: "Arabian Peninsula",
    lat: 20.5, lon: 50.5,
    temperature: 32, altitude: 300,
    pressure: 98, aridity: 10, soil: 7,
    type: "climate",
    climate: "Hot sand desert",
    description:
      "A vast sand sea useful for studying dune patterns, wind-shaped surfaces and extreme aridity."
  }
];

let mode = "moon";
let globe;
let markers = [];
let selectedSite = null;
const climateCache = new Map();
let activeClimateKey = null;
let climateRequestId = 0;

const $ = id => document.getElementById(id);

function formatValue(value, unit) {
  return unit === "°C" ? `${value} °C`
    : unit === "m" ? `${value.toLocaleString()} m`
    : unit === "kPa" ? `${value} kPa`
    : `${value} / 10`;
}

function renderFilters() {
  const container = $("filters");
  container.innerHTML = "";

  FILTERS.forEach(filter => {
    const target = filter[mode];

    const element = document.createElement("div");
    element.className = "filter";

    element.innerHTML = `
      <div class="filter-head">
        <label class="filter-label">
          <input type="checkbox" id="enable-${filter.id}" checked>
          ${filter.label}
        </label>
        <span class="filter-value" id="value-${filter.id}">
          ${formatValue(target, filter.unit)}
        </span>
      </div>

      <input
        class="range"
        type="range"
        id="range-${filter.id}"
        min="${filter.min}"
        max="${filter.max}"
        step="${filter.unit === "m" ? 50 : 1}"
        value="${target}"
        aria-label="${filter.label} target value"
      >

      <div class="range-labels">
        <span>${formatValue(filter.min, filter.unit)}</span>
        <span>${formatValue(filter.max, filter.unit)}</span>
      </div>
    `;

    container.appendChild(element);

    $(`range-${filter.id}`).addEventListener("input", () => {
      const value = Number($(`range-${filter.id}`).value);
      $(`value-${filter.id}`).textContent =
        formatValue(value, filter.unit);
      updateMap();
    });

    $(`enable-${filter.id}`).addEventListener("change", updateMap);
  });
}

function renderSitePicker() {
  const picker = $("sitePicker");
  SITES.forEach(site => {
    const option = document.createElement("option");
    option.value = site.name;
    option.textContent = site.name;
    picker.appendChild(option);
  });
}

function scoreSite(site) {
  const active = FILTERS.filter(filter =>
    $(`enable-${filter.id}`).checked
  );

  if (active.length === 0) return 100;

  const scores = active.map(filter => {
    const target = Number($(`range-${filter.id}`).value);
    const range = filter.max - filter.min;
    const difference = Math.abs(site[filter.id] - target);

    return Math.max(0, 100 * (1 - difference / range));
  });

  return Math.round(
    scores.reduce((total, value) => total + value, 0) /
    scores.length
  );
}

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

function markerClass(score) {
  if (score >= 70) return "strong";
  if (score < 40) return "weak";
  return "";
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

  const showTerrain = $("terrainToggle").checked;
  const showClimate = $("climateToggle").checked;

  const visibleSites = SITES
    .map(site => ({
      ...site,
      score: scoreSite(site),
      winterSunElevation: winterSolstice(site.lat).elevation
    }))
    .filter(site =>
      site.type === "terrain" ? showTerrain : showClimate
    );

  visibleSites.forEach(site => {
    const classes = [
      "marker",
      markerClass(site.score),
      mode === "mars" ? "mars" : "",
      site.type === "climate" ? "climate" : "",
      site.winterSunElevation <= LOW_LIGHT_THRESHOLD ? "unfaked-light" : ""
    ].filter(Boolean).join(" ");

    const marker = document.createElement("button");
    const { position, normal } = globePosition(site);
    marker.type = "button";
    marker.className = classes;
    marker.slot =
      `hotspot-${site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    marker.dataset.position = position;
    marker.dataset.normal = normal;
    marker.dataset.visibilityAttribute = "visible";
    const lowLightDescription =
      site.winterSunElevation <= LOW_LIGHT_THRESHOLD
        ? ` · UNFAKED LIGHT ZONE · winter-solstice Sun ${site.winterSunElevation.toFixed(1)}°`
        : "";
    marker.title = `${site.name} · ${site.score}% match${lowLightDescription}`;
    marker.setAttribute("aria-label", marker.title);
    marker.addEventListener("click", () => openSite(site));
    marker.addEventListener("mouseenter", () => {
      $("coordinates").textContent =
        `LAT ${site.lat.toFixed(3)}° · LON ${site.lon.toFixed(3)}°`;
    });
    marker.addEventListener("focus", () => {
      $("coordinates").textContent =
        `LAT ${site.lat.toFixed(3)}° · LON ${site.lon.toFixed(3)}°`;
    });

    globe.appendChild(marker);

    markers.push(marker);
  });

  const strongMatches =
    visibleSites.filter(site => site.score >= 70).length;

  $("siteCount").textContent =
    String(visibleSites.length).padStart(2, "0");

  $("progressBar").style.width =
    visibleSites.length
      ? `${100 * strongMatches / visibleSites.length}%`
      : "0%";

  $("matchSummary").textContent = visibleSites.length
    ? `${strongMatches} strong matches out of ${visibleSites.length} visible sites.`
    : "No sites visible. Turn on a map layer.";

  if (selectedSite) {
    const updated = visibleSites.find(
      site => site.name === selectedSite.name
    );

    if (updated) {
      openSite(updated, false, false);
    } else {
      $("siteCard").classList.add("hidden");
      selectedSite = null;
      $("sitePicker").value = "";
    }
  }
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

  $("modeDescription").textContent = mode === "moon"
    ? "Find Earth environments with conditions similar to the Moon."
    : "Explore Earth environments useful for comparing with Mars.";

  document.documentElement.style.setProperty(
    "--accent",
    mode === "moon" ? "#e9bd76" : "#e77b5e"
  );

  renderFilters();
  selectedSite = null;
  $("sitePicker").value = "";
  $("siteCard").classList.add("hidden");
  updateSiteUrl();
  updateSunCalculator(Number($("sunLatitude").value));
  updateMap();
}

$("moonBtn").addEventListener("click", () => setMode("moon"));
$("marsBtn").addEventListener("click", () => setMode("mars"));

$("resetBtn").addEventListener("click", () => {
  FILTERS.forEach(filter => {
    $(`enable-${filter.id}`).checked = true;
    $(`range-${filter.id}`).value = filter[mode];
    $(`value-${filter.id}`).textContent =
      formatValue(filter[mode], filter.unit);
  });

  updateMap();
});

$("terrainToggle").addEventListener("change", updateMap);
$("climateToggle").addEventListener("change", updateMap);

$("showAllBtn").addEventListener("click", () => {
  globe.cameraTarget = "0m 0m 0m";
  globe.cameraOrbit = "0deg 75deg 1500m";
  selectedSite = null;
  $("sitePicker").value = "";
  $("siteCard").classList.add("hidden");
  updateSiteUrl();
});

$("zoomInBtn").addEventListener("click", () => zoomGlobe(0.82));
$("zoomOutBtn").addEventListener("click", () => zoomGlobe(1.22));

$("sitePicker").addEventListener("change", () => {
  const site = SITES.find(candidate => candidate.name === $("sitePicker").value);
  if (site) {
    openSite({ ...site, score: scoreSite(site) });
  } else {
    selectedSite = null;
    $("siteCard").classList.add("hidden");
    updateSiteUrl();
  }
});

$("sunLatitude").addEventListener("input", () => {
  updateSunCalculator(Number($("sunLatitude").value));
});

$("closeCard").addEventListener("click", () => {
  $("siteCard").classList.add("hidden");
  selectedSite = null;
  $("sitePicker").value = "";
  updateSiteUrl();
});

$("exportSite").addEventListener("click", exportSiteJson);

$("refreshClimate").addEventListener("click", () => {
  if (selectedSite) loadClimateData(selectedSite, true);
});

initGlobe();
renderSitePicker();
updateSunCalculator(Number($("sunLatitude").value));
renderFilters();
updateMap();

const requestedSite = new URLSearchParams(window.location.search).get("site");
const deepLinkedSite = SITES.find(site => site.name === requestedSite);
if (deepLinkedSite) {
  openSite({ ...deepLinkedSite, score: scoreSite(deepLinkedSite) });
}
