
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
    .map(site => ({ ...site, score: scoreSite(site) }))
    .filter(site =>
      site.type === "terrain" ? showTerrain : showClimate
    );

  visibleSites.forEach(site => {
    const classes = [
      "marker",
      markerClass(site.score),
      mode === "mars" ? "mars" : "",
      site.type === "climate" ? "climate" : ""
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
    marker.title = `${site.name} · ${site.score}% match`;
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
      openSite(updated, false);
    } else {
      $("siteCard").classList.add("hidden");
      selectedSite = null;
    }
  }
}

function openSite(site, zoom = true) {
  selectedSite = site;

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

  if (zoom) {
    focusSite(site);
  }
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
  $("siteCard").classList.add("hidden");
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
  $("siteCard").classList.add("hidden");
});

$("zoomInBtn").addEventListener("click", () => zoomGlobe(0.82));
$("zoomOutBtn").addEventListener("click", () => zoomGlobe(1.22));

$("closeCard").addEventListener("click", () => {
  $("siteCard").classList.add("hidden");
  selectedSite = null;
});

function showView(view) {
  const showLab = view === "lab";
  $("atlasView").classList.toggle("hidden", showLab);
  $("lunarLabView").classList.toggle("hidden", !showLab);
  $("atlasTab").classList.toggle("active", !showLab);
  $("lunarLabTab").classList.toggle("active", showLab);
  $("atlasTab").setAttribute("aria-pressed", String(!showLab));
  $("lunarLabTab").setAttribute("aria-pressed", String(showLab));
}

$("atlasTab").addEventListener("click", () => showView("atlas"));
$("lunarLabTab").addEventListener("click", () => showView("lab"));

initGlobe();
renderFilters();
updateMap();
