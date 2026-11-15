"use strict";

/* Otherworld Atlas
 *
 * Left panel: flat equirectangular map of the Moon or Mars, cut into the
 * scientifically mapped quadrangles (LQ-01 … LQ-30 / MC-01 … MC-30).
 * Selecting a quadrangle sends its latitude/longitude extent to the analogue
 * API and plots the returned Earth analogues on the globe.
 */

const LOCAL_API_URL =
  ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://127.0.0.1:8000"
    : location.origin;
const API_URL = (
  new URLSearchParams(location.search).get("api") ||
  window.OTHERWORLD_API_URL ||
  LOCAL_API_URL
).replace(/\/+$/, "");
const CURATED_PROFILES_PER_PAGE = 20;
const MODIS_WINDOWS = [
  ["A2025001", "A2025073"],
  ["A2025177", "A2025249"]
];
const MODIS_BANDS = ["LST_Day_1km", "LST_Night_1km"];
const CLIMATE_YEAR = 2025;

const QUADRANGLES = {
  mars: [
    { id: "MC-01", name: "Mare Boreum",           latMin:   65.0, latMax:   90.0, lonMin:   0.0, lonMax: 360.0 },
    { id: "MC-02", name: "Diacria",               latMin:   30.0, latMax:   65.0, lonMin: 180.0, lonMax: 240.0 },
    { id: "MC-03", name: "Arcadia",               latMin:   30.0, latMax:   65.0, lonMin: 240.0, lonMax: 300.0 },
    { id: "MC-04", name: "Mare Acidalium",        latMin:   30.0, latMax:   65.0, lonMin: 300.0, lonMax: 360.0 },
    { id: "MC-05", name: "Ismenius Lacus",        latMin:   30.0, latMax:   65.0, lonMin:   0.0, lonMax:  60.0 },
    { id: "MC-06", name: "Casius",                latMin:   30.0, latMax:   65.0, lonMin:  60.0, lonMax: 120.0 },
    { id: "MC-07", name: "Cebrenia",              latMin:   30.0, latMax:   65.0, lonMin: 120.0, lonMax: 180.0 },
    { id: "MC-08", name: "Amazonis",              latMin:    0.0, latMax:   30.0, lonMin: 180.0, lonMax: 225.0 },
    { id: "MC-09", name: "Tharsis",               latMin:    0.0, latMax:   30.0, lonMin: 225.0, lonMax: 270.0 },
    { id: "MC-10", name: "Lunae Palus",           latMin:    0.0, latMax:   30.0, lonMin: 270.0, lonMax: 315.0 },
    { id: "MC-11", name: "Oxia Palus",            latMin:    0.0, latMax:   30.0, lonMin: 315.0, lonMax: 360.0 },
    { id: "MC-12", name: "Arabia",                latMin:    0.0, latMax:   30.0, lonMin:   0.0, lonMax:  45.0 },
    { id: "MC-13", name: "Syrtis Major",          latMin:    0.0, latMax:   30.0, lonMin:  45.0, lonMax:  90.0 },
    { id: "MC-14", name: "Amenthes",              latMin:    0.0, latMax:   30.0, lonMin:  90.0, lonMax: 135.0 },
    { id: "MC-15", name: "Elysium",               latMin:    0.0, latMax:   30.0, lonMin: 135.0, lonMax: 180.0 },
    { id: "MC-16", name: "Memnonia",              latMin:  -30.0, latMax:    0.0, lonMin: 180.0, lonMax: 225.0 },
    { id: "MC-17", name: "Phoenicis Lacus",       latMin:  -30.0, latMax:    0.0, lonMin: 225.0, lonMax: 270.0 },
    { id: "MC-18", name: "Coprates",              latMin:  -30.0, latMax:    0.0, lonMin: 270.0, lonMax: 315.0 },
    { id: "MC-19", name: "Margaritifer Sinus",    latMin:  -30.0, latMax:    0.0, lonMin: 315.0, lonMax: 360.0 },
    { id: "MC-20", name: "Sinus Sabaeus",         latMin:  -30.0, latMax:    0.0, lonMin:   0.0, lonMax:  45.0 },
    { id: "MC-21", name: "Iapygia",               latMin:  -30.0, latMax:    0.0, lonMin:  45.0, lonMax:  90.0 },
    { id: "MC-22", name: "Mare Tyrrhenum",        latMin:  -30.0, latMax:    0.0, lonMin:  90.0, lonMax: 135.0 },
    { id: "MC-23", name: "Aeolis",                latMin:  -30.0, latMax:    0.0, lonMin: 135.0, lonMax: 180.0 },
    { id: "MC-24", name: "Phaethontis",           latMin:  -65.0, latMax:  -30.0, lonMin: 180.0, lonMax: 240.0 },
    { id: "MC-25", name: "Thaumasia",             latMin:  -65.0, latMax:  -30.0, lonMin: 240.0, lonMax: 300.0 },
    { id: "MC-26", name: "Argyre",                latMin:  -65.0, latMax:  -30.0, lonMin: 300.0, lonMax: 360.0 },
    { id: "MC-27", name: "Noachis",               latMin:  -65.0, latMax:  -30.0, lonMin:   0.0, lonMax:  60.0 },
    { id: "MC-28", name: "Hellas",                latMin:  -65.0, latMax:  -30.0, lonMin:  60.0, lonMax: 120.0 },
    { id: "MC-29", name: "Eridania",              latMin:  -65.0, latMax:  -30.0, lonMin: 120.0, lonMax: 180.0 },
    { id: "MC-30", name: "Mare Australe",         latMin:  -90.0, latMax:  -65.0, lonMin:   0.0, lonMax: 360.0 }
  ],
  moon: [
    { id: "LQ-01", name: null,                    latMin:   60.0, latMax:   90.0, lonMin:   0.0, lonMax: 360.0 },
    { id: "LQ-02", name: null,                    latMin:   30.0, latMax:   60.0, lonMin: 180.0, lonMax: 240.0 },
    { id: "LQ-03", name: null,                    latMin:   30.0, latMax:   60.0, lonMin: 240.0, lonMax: 300.0 },
    { id: "LQ-04", name: null,                    latMin:   30.0, latMax:   60.0, lonMin: 300.0, lonMax: 360.0 },
    { id: "LQ-05", name: null,                    latMin:   30.0, latMax:   60.0, lonMin:   0.0, lonMax:  60.0 },
    { id: "LQ-06", name: null,                    latMin:   30.0, latMax:   60.0, lonMin:  60.0, lonMax: 120.0 },
    { id: "LQ-07", name: null,                    latMin:   30.0, latMax:   60.0, lonMin: 120.0, lonMax: 180.0 },
    { id: "LQ-08", name: null,                    latMin:    0.0, latMax:   30.0, lonMin: 180.0, lonMax: 225.0 },
    { id: "LQ-09", name: null,                    latMin:    0.0, latMax:   30.0, lonMin: 225.0, lonMax: 270.0 },
    { id: "LQ-10", name: null,                    latMin:    0.0, latMax:   30.0, lonMin: 270.0, lonMax: 315.0 },
    { id: "LQ-11", name: null,                    latMin:    0.0, latMax:   30.0, lonMin: 315.0, lonMax: 360.0 },
    { id: "LQ-12", name: null,                    latMin:    0.0, latMax:   30.0, lonMin:   0.0, lonMax:  45.0 },
    { id: "LQ-13", name: null,                    latMin:    0.0, latMax:   30.0, lonMin:  45.0, lonMax:  90.0 },
    { id: "LQ-14", name: null,                    latMin:    0.0, latMax:   30.0, lonMin:  90.0, lonMax: 135.0 },
    { id: "LQ-15", name: null,                    latMin:    0.0, latMax:   30.0, lonMin: 135.0, lonMax: 180.0 },
    { id: "LQ-16", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin: 180.0, lonMax: 225.0 },
    { id: "LQ-17", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin: 225.0, lonMax: 270.0 },
    { id: "LQ-18", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin: 270.0, lonMax: 315.0 },
    { id: "LQ-19", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin: 315.0, lonMax: 360.0 },
    { id: "LQ-20", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin:   0.0, lonMax:  45.0 },
    { id: "LQ-21", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin:  45.0, lonMax:  90.0 },
    { id: "LQ-22", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin:  90.0, lonMax: 135.0 },
    { id: "LQ-23", name: null,                    latMin:  -30.0, latMax:    0.0, lonMin: 135.0, lonMax: 180.0 },
    { id: "LQ-24", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin: 180.0, lonMax: 240.0 },
    { id: "LQ-25", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin: 240.0, lonMax: 300.0 },
    { id: "LQ-26", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin: 300.0, lonMax: 360.0 },
    { id: "LQ-27", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin:   0.0, lonMax:  60.0 },
    { id: "LQ-28", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin:  60.0, lonMax: 120.0 },
    { id: "LQ-29", name: null,                    latMin:  -60.0, latMax:  -30.0, lonMin: 120.0, lonMax: 180.0 },
    { id: "LQ-30", name: null,                    latMin:  -90.0, latMax:  -60.0, lonMin:   0.0, lonMax: 360.0 }
  ]
};

const PLANETS = {
  moon: {
    label: "Moon",
    apiBody: "Moon",
    title: "Moon · LQ chart",
    series: "LQ",
    map: "./assets/media/lroc_color_2k.jpg",
    credit: "NASA LROC colour mosaic"
  },
  mars: {
    label: "Mars",
    apiBody: "Mars",
    title: "Mars · MC chart",
    series: "MC",
    map: "./assets/media/mars_basemap.jpg",
    credit: "NASA / USGS Viking MDIM 2.1 colour mosaic"
  }
};

const ANAGLOG_LIMIT = 5;
const MONTHS = [
  ["JAN", "Jan"], ["FEB", "Feb"], ["MAR", "Mar"], ["APR", "Apr"],
  ["MAY", "May"], ["JUN", "Jun"], ["JUL", "Jul"], ["AUG", "Aug"],
  ["SEP", "Sep"], ["OCT", "Oct"], ["NOV", "Nov"], ["DEC", "Dec"]
];

let mode = "moon";
let selectedQuadrangle = null;
let analogueResult = null;
let analogueMarkers = [];
let selectedAnalogue = null;
let gridWorker = null;
let gridReady = false;
let gridScanResults = [];
let gridMarkers = [];
let selectedGridCandidate = null;
let curatedProfiles = [];
let curatedProfilesLoad = null;
let curatedProfilePage = 0;
let selectedCuratedProfileId = null;
const modisCache = new Map();
let modisRequestActive = false;
const climateCache = new Map();
let activeClimateKey = null;
let climateRequestId = 0;

const $ = id => document.getElementById(id);

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

function formatLatitude(value) {
  const rounded = Math.abs(value) % 1 === 0
    ? Math.abs(value).toFixed(0)
    : Math.abs(value).toFixed(1);
  if (value === 0) return "0°";
  return `${rounded}°${value > 0 ? "N" : "S"}`;
}

function formatLongitudeCentral(value) {
  const east = ((value % 360) + 360) % 360;
  const signed = east > 180 ? east - 360 : east;
  const rounded = Math.abs(signed) % 1 === 0
    ? Math.abs(signed).toFixed(0)
    : Math.abs(signed).toFixed(1);
  if (signed === 0) return "0°";
  return `${rounded}°${signed > 0 ? "E" : "W"}`;
}

function formatLongitudeEast(value) {
  const rounded = Math.abs(value) % 1 === 0
    ? value.toFixed(0)
    : value.toFixed(1);
  return `${rounded}°E`;
}

function bandLabel(quadrangle) {
  if (quadrangle.latMin >= 60) return "North polar cap";
  if (quadrangle.latMax <= -60) return "South polar cap";
  if (quadrangle.latMin >= 30) return "North mid-latitudes";
  if (quadrangle.latMax <= -30) return "South mid-latitudes";
  if (quadrangle.latMin >= 0) return "Equatorial north";
  return "Equatorial south";
}

function quadrangleCenter(quadrangle) {
  return {
    latitude: (quadrangle.latMin + quadrangle.latMax) / 2,
    longitude: (quadrangle.lonMin + quadrangle.lonMax) / 2
  };
}

/* ------------------------------------------------------------------ *
 * Flat quadrangle map
 * ------------------------------------------------------------------ */

// The map is drawn in a −180°…180° frame so longitude 0 sits at its centre.
function mapX(longitudeEast) {
  const east = ((Number(longitudeEast) % 360) + 360) % 360;
  return ((east + 180) % 360) - 180;
}

function mapY(latitude) {
  return 90 - latitude;
}

// Quadrangles use 0–360°E; convert an extent into one or two map rectangles.
function quadranglePieces(quadrangle) {
  const y = mapY(quadrangle.latMax);
  const height = quadrangle.latMax - quadrangle.latMin;
  const span = quadrangle.lonMax - quadrangle.lonMin;

  if (span >= 359.9) {
    return [{ x: -180, y, width: 360, height }];
  }

  const start = mapX(quadrangle.lonMin);
  const end = start + span;

  if (end <= 180) {
    return [{ x: start, y, width: span, height }];
  }

  return [
    { x: start, y, width: 180 - start, height },
    { x: -180, y, width: end - 180, height }
  ];
}

function buildQuadrangleMap() {
  const container = $("quadrangle-map");
  if (!container) return;

  const planet = PLANETS[mode];
  // Resolve against the document: relative URLs inside CSS custom properties
  // would otherwise resolve against the stylesheet in assets/css/.
  container.style.setProperty(
    "--planet-map-image",
    `url("${new URL(planet.map, document.baseURI).href}")`
  );

  const list = QUADRANGLES[mode] || [];
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "-180 0 360 180");
  svg.setAttribute("class", "quadrangle-svg");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const cellLayer = document.createElementNS(ns, "g");
  const labelLayer = document.createElementNS(ns, "g");

  list.forEach(quadrangle => {
    const pieces = quadranglePieces(quadrangle);
    const bounds = pieces.reduce(
      (widest, piece) => piece.width > widest.width ? piece : widest,
      pieces[0]
    );

    const cell = document.createElementNS(ns, "rect");
    cell.setAttribute("x", String(bounds.x));
    cell.setAttribute("y", String(bounds.y));
    cell.setAttribute("width", String(bounds.width));
    cell.setAttribute("height", String(bounds.height));
    cell.setAttribute("class", "quad-cell");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("role", "button");
    cell.setAttribute(
      "aria-label",
      `${quadrangle.id}${quadrangle.name ? ` ${quadrangle.name}` : ""} · ` +
      `${formatLatitude(quadrangle.latMin)} to ${formatLatitude(quadrangle.latMax)}`
    );
    cell.dataset.quadrangle = quadrangle.id;

    const tooltip = document.createElementNS(ns, "title");
    tooltip.textContent = cell.getAttribute("aria-label");
    cell.appendChild(tooltip);

    cell.addEventListener("mouseenter", () => setHover(quadrangle));
    cell.addEventListener("focus", () => setHover(quadrangle));
    cell.addEventListener("click", () => selectQuadrangle(quadrangle.id));
    cell.addEventListener("mouseleave", () => {
      if (hoveredQuadrangle !== quadrangle) return;
      hoveredQuadrangle = null;
      updateHoverText();
    });
    cell.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectQuadrangle(quadrangle.id);
    });
    cellLayer.appendChild(cell);

    // Wide quadrangles are drawn as two seam-less pieces; label each piece so
    // the selector stays readable across the 180° edge.
    pieces.forEach(piece => {
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(piece.x + piece.width / 2));
      label.setAttribute("y", String(piece.y + piece.height / 2 + 2.6));
      label.setAttribute("class", "quad-label");
      label.textContent = quadrangle.id.replace(`${planet.series}-`, "");
      labelLayer.appendChild(label);
    });
  });

  svg.append(cellLayer, labelLayer);
  container.replaceChildren(svg);

  svg.addEventListener("mouseleave", () => {
    if (!hoveredQuadrangle) return;
    hoveredQuadrangle = null;
    updateHoverText();
  });

  $("planet-map-title").textContent = planet.title;
  container.setAttribute(
    "aria-label",
    `Flat equirectangular map of ${planet.label} divided into quadrangles ${planet.series}-01 to ${planet.series}-30`
  );

  selectedQuadrangle = null;
  $("run-analysis").disabled = true;
  $("selected-quadrangle").textContent = "No quadrangle selected";
  $("selected-quadrangle-name").textContent = "";
  $("quadrangle-extent").textContent = "--";
  $("quadrangle-centre").textContent = "--";
  $("quadrangle-band").textContent = "--";
  $("analysis-status").textContent =
    "Select a quadrangle, then query the analogue model.";
  clearAnalogueResults();

  const pickerSelect = $("quadrangleSelect");
  pickerSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a quadrangle…";
  pickerSelect.appendChild(placeholder);
  list.forEach(quadrangle => {
    const option = document.createElement("option");
    option.value = quadrangle.id;
    option.textContent = quadrangle.name
      ? `${quadrangle.id} · ${quadrangle.name}`
      : `${quadrangle.id} · ${bandLabel(quadrangle)}`;
    pickerSelect.appendChild(option);
  });

  highlightCells();
}

let hoveredQuadrangle = null;

function setHover(quadrangle) {
  hoveredQuadrangle = quadrangle;
  updateHoverText();
}

function updateHoverText() {
  const target = $("quadrangle-hover");
  if (!target) return;
  if (!hoveredQuadrangle) {
    target.textContent =
      "Hover the map to inspect a quadrangle, or choose one from the list.";
    return;
  }
  const quadrangle = hoveredQuadrangle;
  target.textContent =
    `${quadrangle.id}${quadrangle.name ? ` · ${quadrangle.name}` : ""} · ` +
    `${formatLatitude(quadrangle.latMin)} to ${formatLatitude(quadrangle.latMax)}`;
}

function highlightCells() {
  document.querySelectorAll("[data-quadrangle]").forEach(element => {
    element.classList.toggle(
      "selected",
      Boolean(selectedQuadrangle) &&
        element.dataset.quadrangle === selectedQuadrangle.id
    );
  });
}

function selectQuadrangle(id) {
  const quadrangle = (QUADRANGLES[mode] || []).find(item => item.id === id);
  if (!quadrangle) return;

  selectedQuadrangle = quadrangle;
  highlightCells();

  const center = quadrangleCenter(quadrangle);
  const fullLongitude = quadrangle.lonMax - quadrangle.lonMin >= 359.9;

  $("selected-quadrangle").textContent = quadrangle.id;
  $("selected-quadrangle-name").textContent = quadrangle.name || bandLabel(quadrangle);
  $("quadrangle-extent").textContent = fullLongitude
    ? `${formatLatitude(quadrangle.latMin)} to ${formatLatitude(quadrangle.latMax)} · all longitudes`
    : `${formatLongitudeEast(quadrangle.lonMin)} – ${formatLongitudeEast(quadrangle.lonMax)} · ` +
      `${formatLatitude(quadrangle.latMin)} to ${formatLatitude(quadrangle.latMax)}`;
  $("quadrangle-centre").textContent =
    `${formatLatitude(center.latitude)}, ${formatLongitudeCentral(center.longitude)}`;
  $("quadrangle-band").textContent = bandLabel(quadrangle);

  $("quadrangleSelect").value = quadrangle.id;
  $("run-analysis").disabled = false;
  $("analysis-status").textContent =
    `${quadrangle.id} selected · send ${formatLatitude(center.latitude)}, ` +
    `${formatLongitudeCentral(center.longitude)} to the analogue model.`;
}

/* ------------------------------------------------------------------ *
 * Analogue model API
 * ------------------------------------------------------------------ */

async function requestAnalogs(payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${API_URL}/api/analogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result?.detail || `The analogue model returned HTTP ${response.status}.`
      );
    }
    if (!result) {
      throw new Error("The analogue model returned an empty response.");
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function runAnalysis() {
  if (!selectedQuadrangle) return;
  const quadrangle = selectedQuadrangle;
  const planet = PLANETS[mode];
  const button = $("run-analysis");

  button.disabled = true;
  $("analysis-status").textContent =
    `Querying ${planet.label} ${quadrangle.id} on ${API_URL} …`;
  $("analogue-results").replaceChildren();

  try {
    const result = await requestAnalogs({
      body: planet.apiBody,
      lat_min: quadrangle.latMin,
      lat_max: quadrangle.latMax,
      lon_start: quadrangle.lonMin,
      lon_end: quadrangle.lonMax,
      top_n: ANAGLOG_LIMIT
    });

    analogueResult = result;
    renderAnalogueResults(result, quadrangle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    analogueResult = null;
    clearAnalogueMarkers();
    $("analysis-status").textContent =
      /aborted|Failed to fetch|NetworkError|Load failed/i.test(message)
        ? `Model API unreachable at ${API_URL}. Start it with "uvicorn main:app --port 8000" inside the api folder, then retry.`
        : `Model request failed: ${message}`;
    console.error("Analogue model request failed.", error);
  } finally {
    button.disabled = false;
  }
}

function renderAnalogueResults(result, quadrangle) {
  const list = $("analogue-results");
  list.replaceChildren();
  clearAnalogueMarkers();

  const analogues = Array.isArray(result.analogues) ? result.analogues : [];
  const coordinates = result.coordinates || {};
  const body = result.body || PLANETS[mode].label;

  $("analysis-status").textContent = analogues.length
    ? `${body} ${result.quadrangle} · midpoint ${formatLatitude(coordinates.latitude)}, ` +
      `${formatLongitudeCentral(coordinates.longitude)} · ${analogues.length} ranked Earth analogues.`
    : `The model returned no Earth analogues for ${result.quadrangle}.`;

  if (!analogues.length) return;

  analogues.forEach((analogue, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `analogue-result${index === 0 ? " is-best" : ""}`;

    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(2, "0")} · ${analogue["Earth analogue"]}`;

    const meta = document.createElement("span");
    meta.className = "analogue-meta";
    meta.textContent = analogue.coordinates_available
      ? `${analogue["Similarity (%)"]}% similarity · ${analogue["Country / region"] || "location not given"}`
      : `${analogue["Similarity (%)"]}% similarity · no recorded coordinates`;

    button.append(title, meta);

    const breaks = analogueFields(result, analogue).fields
      .filter(field => Number(field.similarity) < BREAK_THRESHOLD)
      .map(field => field.parameter);
    if (breaks.length) {
      const breakLine = document.createElement("span");
      breakLine.className = "analogue-breaks";
      breakLine.textContent =
        `Breaks on ${breaks.slice(0, 3).join(", ")}` +
        (breaks.length > 3 ? ` +${breaks.length - 3} more` : "");
      button.appendChild(breakLine);
    } else {
      const breakLine = document.createElement("span");
      breakLine.className = "analogue-breaks holds";
      breakLine.textContent = "No scored field falls below the break threshold";
      button.appendChild(breakLine);
    }
    button.addEventListener("click", () => openAnalogue(result, analogue, index));
    item.appendChild(button);
    list.appendChild(item);

    if (analogue.coordinates_available) {
      list.appendChild(createAnalogueMarker(result, analogue, index));
    }
  });

  $("gridMapHint").classList.add("hidden");
  $("gridMapTip").textContent =
    "ⓘ Click a marker to inspect that Earth analogue.";

  const best = analogues.find(item => item.coordinates_available) || analogues[0];
  if (best) openAnalogue(result, best, 0);
}

function createAnalogueMarker(result, analogue, index) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `marker global-marker${index === 0 ? " global-best" : ""}`;
  marker.slot = `hotspot-analogue-${index + 1}`;

  const position = globePosition(analogue);
  marker.dataset.position = position.position;
  marker.dataset.normal = position.normal;
  marker.dataset.visibilityAttribute = "visible";

  marker.title =
    `${analogue["Earth analogue"]} · ${analogue["Similarity (%)"]}% · ` +
    `${formatLatitude(analogue.latitude)}, ${formatLongitudeCentral(analogue.longitude)}`;
  marker.setAttribute("aria-label", marker.title);
  marker.addEventListener("click", () => openAnalogue(result, analogue, index));

  $("map").appendChild(marker);
  analogueMarkers.push(marker);

  const listItem = document.createElement("li");
  listItem.className = "analogue-marker-item";
  const link = document.createElement("button");
  link.type = "button";
  link.className = "analogue-marker-link";
  link.textContent =
    `${String(index + 1).padStart(2, "0")} · ${formatLatitude(analogue.latitude)}, ` +
    `${formatLongitudeCentral(analogue.longitude)}`;
  link.addEventListener("click", () => openAnalogue(result, analogue, index));
  listItem.appendChild(link);
  return listItem;
}

function clearAnalogueMarkers() {
  analogueMarkers.forEach(marker => marker.remove());
  analogueMarkers = [];
}

function clearAnalogueResults() {
  clearAnalogueMarkers();
  analogueResult = null;
  const list = $("analogue-results");
  if (list) list.replaceChildren();
}

/* ------------------------------------------------------------------ *
 * Globe
 * ------------------------------------------------------------------ */

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
  const globe = $("map");

  // The fallback must never cover a model that is already on screen: a stray
  // error (for example a poster or probe request) must not show it, and a real
  // load failure is only reported when the model is still missing afterwards.
  let failureTimer = null;

  const hideFallback = () => {
    if (failureTimer) {
      window.clearTimeout(failureTimer);
      failureTimer = null;
    }
    $("globeFallback").classList.add("hidden");
  };

  globe.addEventListener("load", () => {
    hideFallback();
    if (selectedAnalogue) focusSite(selectedAnalogue);
  });

  globe.addEventListener("error", () => {
    if (globe.loaded) return;
    if (failureTimer) window.clearTimeout(failureTimer);
    failureTimer = window.setTimeout(() => {
      failureTimer = null;
      if (globe.loaded) return;
      const reason = $("globeFallbackReason");
      if (reason) {
        reason.textContent = location.protocol === "file:"
          ? "This page is open from a file path. Browsers block the 3D model there — serve the folder over HTTP (python3 -m http.server 8848) and reload."
          : `The model at ${globe.getAttribute("src")} could not be loaded. Check that the file exists and that the page is served over HTTP.`;
      }
      $("globeFallback").classList.remove("hidden");
    }, 1200);
  });

  $("retryGlobeModel").addEventListener("click", () => {
    const modelUrl = new URL(globe.getAttribute("src"), document.baseURI);
    modelUrl.searchParams.set("retry", String(Date.now()));
    hideFallback();
    globe.src = modelUrl.href;
  });

  $("showAllBtn").addEventListener("click", () => {
    globe.cameraTarget = "0m 0m 0m";
    globe.cameraOrbit = "0deg 75deg 1500m";
    selectedAnalogue = null;
    $("siteCard").classList.add("hidden");
    $("coordinates").textContent = "DRAG TO ROTATE · SELECT A QUADRANGLE TO PLOT ANALOGUES";
  });

  $("zoomInBtn").addEventListener("click", () => zoomGlobe(0.82));
  $("zoomOutBtn").addEventListener("click", () => zoomGlobe(1.22));
}

function focusSite(site) {
  const globe = $("map");
  if (!globe.loaded) return;

  const { radius } = globe.getCameraOrbit();
  const theta = site.lon + 180;
  const phi = 90 - site.lat;
  globe.cameraOrbit = `${theta}deg ${phi}deg ${Math.min(radius, 950)}m`;
}

function zoomGlobe(factor) {
  const globe = $("map");
  if (!globe.loaded) return;

  const { theta, phi, radius } = globe.getCameraOrbit();
  const nextRadius = Math.max(620, Math.min(2500, radius * factor));
  globe.cameraOrbit = `${theta}rad ${phi}rad ${nextRadius}m`;
}

/* ------------------------------------------------------------------ *
 * Analogue site card
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Where a candidate breaks: field-by-field fit
 * ------------------------------------------------------------------ */

const BREAK_THRESHOLD = 40;
const CAUTION_THRESHOLD = 70;

const PARAMETER_UNITS = {
  "Mean elevation": " m",
  "Mean slope": "°",
  "Annual mean temperature": " °C",
  "Mean annual temperature": " °C"
};

function formatParameterValue(label, value) {
  if (value === null || value === undefined || value === "") return "no value";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);

  const unit = PARAMETER_UNITS[label] || "";
  const magnitude = Math.abs(number);
  if (magnitude >= 1000) return `${Math.round(number).toLocaleString()}${unit}`;
  if (magnitude >= 10) return `${number.toFixed(0)}${unit}`;
  if (magnitude >= 1) return `${number.toFixed(1)}${unit}`;
  return `${number.toFixed(2)}${unit}`;
}

function similarityBand(similarity) {
  if (similarity < BREAK_THRESHOLD) return { band: "break", label: "BREAKS" };
  if (similarity < CAUTION_THRESHOLD) return { band: "caution", label: "CAUTION" };
  return { band: "holds", label: "HOLDS" };
}

/** Field-by-field comparison for one candidate, worst field first. */
function analogueFields(result, analogue) {
  const assessment = analogue.assessment;

  if (assessment && Array.isArray(assessment.fields) && assessment.fields.length) {
    return {
      fields: assessment.fields,
      excluded: Array.isArray(assessment.not_scored) ? assessment.not_scored : [],
      summary: assessment.summary || "",
      analysed: true
    };
  }

  const fields = (result.parameter_details || [])
    .filter(row => row["Earth analogue"] === analogue["Earth analogue"])
    .map(row => ({
      parameter: row.Parameter,
      similarity: Number(row["Similarity (%)"]) || 0,
      target: row["Target value"],
      earth: row["Earth value"],
      caveat: ""
    }))
    .sort((a, b) => a.similarity - b.similarity);

  return { fields, excluded: [], summary: "", analysed: false };
}

function renderParameterBreakdown(result, analogue) {
  const list = $("siteParameters");
  const excludedList = $("siteExcluded");
  const summary = $("breakdownSummary");
  if (!list || !excludedList) return;

  const { fields, excluded, summary: apiSummary, analysed } = analogueFields(result, analogue);
  list.replaceChildren();
  excludedList.replaceChildren();

  let lastCaveat = "";

  fields.forEach(field => {
    const similarity = Number(field.similarity) || 0;
    const { band, label } = similarityBand(similarity);

    const item = document.createElement("li");
    item.className = `parameter-row ${band}`;

    const line = document.createElement("div");
    line.className = "parameter-line";

    const name = document.createElement("span");
    name.className = "parameter-name";
    name.textContent = field.parameter;

    const tag = document.createElement("b");
    tag.className = "parameter-band";
    tag.textContent = label;

    const score = document.createElement("b");
    score.className = "parameter-score";
    score.textContent = `${similarity.toFixed(1)}%`;

    line.append(name, tag, score);
    item.appendChild(line);

    const values = document.createElement("div");
    values.className = "parameter-values";
    values.textContent =
      `${formatParameterValue(field.parameter, field.target)} target → ` +
      `${formatParameterValue(field.parameter, field.earth)} here`;
    item.appendChild(values);

    // A field that already fits does not need its caveat spelled out, and the
    // same caveat (for example every mineral) is only printed once.
    if (field.caveat && band !== "holds" && field.caveat !== lastCaveat) {
      const caveat = document.createElement("p");
      caveat.className = "parameter-caveat";
      caveat.textContent = field.caveat;
      item.appendChild(caveat);
      lastCaveat = field.caveat;
    }

    list.appendChild(item);
  });

  if (!fields.length) {
    const item = document.createElement("li");
    item.className = "parameter-row caution";
    item.textContent = "No model field could be compared for this site.";
    list.appendChild(item);
  }

  excluded.forEach(entry => {
    const item = document.createElement("li");
    item.className = "excluded-row";

    const name = document.createElement("strong");
    name.textContent = entry.parameter;

    const kind = document.createElement("span");
    kind.className = "excluded-kind";
    kind.textContent = entry.kind === "reference only"
      ? "EXCLUDED FROM SCORE"
      : "NO COMPARABLE VALUE";

    const reason = document.createElement("p");
    reason.textContent = entry.reason;

    item.append(name, kind, reason);
    excludedList.appendChild(item);
  });

  if (!excluded.length) {
    const item = document.createElement("li");
    item.className = "excluded-row";
    item.textContent = analysed
      ? "Every model field carried a comparable value for this candidate."
      : "Restart the analogue API from api/main.py to list the fields that cannot be scored.";
    excludedList.appendChild(item);
  }

  summary.textContent = apiSummary;
}

function openAnalogue(result, analogue, index, zoom = true) {
  const latitude = analogue.latitude;
  const longitude = analogue.longitude;
  if (!analogue.coordinates_available) {
    $("analysis-status").textContent =
      `${analogue["Earth analogue"]} has no recorded central coordinates in the Earth workbook.`;
    return;
  }

  selectedAnalogue = { lat: latitude, lon: longitude };

  $("siteCard").classList.remove("hidden");
  $("siteType").textContent = `${result.body || PLANETS[mode].label} ${result.quadrangle} · EARTH ANALOGUE`;
  $("siteName").textContent = analogue["Earth analogue"];
  $("siteLocation").textContent =
    `${analogue["Country / region"] || "Location not recorded"} · ` +
    `${formatLatitude(latitude)}, ${formatLongitudeCentral(longitude)}`;

  const score = Number(analogue["Similarity (%)"]) || 0;
  $("siteScore").textContent = `${score}%`;
  $("siteProgress").style.width = `${Math.min(100, score)}%`;

  const fields = analogueFields(result, analogue).fields;
  const weakest = fields[0];

  $("siteDescription").textContent =
    `Rank ${analogue.Rank || index + 1} Earth analogue for ${result.body || ""} ` +
    `${result.quadrangle}${result.quadrangle_name && result.quadrangle_name !== result.quadrangle
      ? ` (${result.quadrangle_name})`
      : ""}. ` +
    `Terrain class: ${analogue["Terrain type"] || "not recorded"}. ` +
    `Model data coverage: ${analogue["Data coverage (%)"]}%. ` +
    (weakest
      ? `Weakest field: ${weakest.parameter} at ${Number(weakest.similarity).toFixed(1)}%. `
      : "") +
    `Similarity is a weighted distance, not a probability.`;

  renderParameterBreakdown(result, analogue);

  $("coordinates").textContent =
    `EARTH ANALOGUE ${String((analogue.Rank || index + 1)).padStart(2, "0")} · ` +
    `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;

  loadClimateData(selectedAnalogue);
  if (zoom) focusSite(selectedAnalogue);
}

/* ------------------------------------------------------------------ *
 * NASA POWER climatology for the selected Earth analogue
 * ------------------------------------------------------------------ */

function climateKey(site) {
  return `${site.lat},${site.lon}`;
}

async function requestClimateData(site) {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.search = new URLSearchParams({
    parameters: "T2M,WS2M,ALLSKY_SFC_SW_DWN",
    community: "AG",
    longitude: String(site.lon),
    latitude: String(site.lat),
    start: `${CLIMATE_YEAR}0101`,
    end: `${CLIMATE_YEAR}1231`,
    format: "JSON"
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NASA POWER request failed with status ${response.status}.`);
  }

  const result = await response.json();
  const parameters = result?.properties?.parameter;
  const dailyValues = ["T2M", "WS2M", "ALLSKY_SFC_SW_DWN"].map(name => {
    const series = parameters?.[name];
    if (!series || typeof series !== "object") {
      throw new Error(`NASA POWER omitted the ${name} daily series.`);
    }
    return Object.entries(series)
      .filter(([date]) => date.startsWith(String(CLIMATE_YEAR)))
      .map(([, value]) => value);
  });
  const isValid = value =>
    typeof value === "number" && Number.isFinite(value) && value !== -999;
  const validSeries = dailyValues.map(series => series.filter(isValid));
  if (validSeries.some(series => series.length < 300)) {
    throw new Error("NASA POWER returned fewer than 300 valid daily values for 2025.");
  }

  const temperaturesByMonth = Array.from({ length: 12 }, () => []);
  Object.entries(parameters.T2M).forEach(([date, value]) => {
    if (date.startsWith(String(CLIMATE_YEAR)) && isValid(value)) {
      const month = Number(date.slice(4, 6)) - 1;
      if (month >= 0 && month < temperaturesByMonth.length) {
        temperaturesByMonth[month].push(value);
      }
    }
  });
  if (temperaturesByMonth.some(month => month.length < 20)) {
    throw new Error("NASA POWER returned incomplete monthly temperature data for 2025.");
  }

  const average = values =>
    values.reduce((total, value) => total + value, 0) / values.length;

  return {
    temperature: average(validSeries[0]),
    windSpeed: average(validSeries[1]),
    solarRadiation: average(validSeries[2]),
    monthlyTemperature: temperaturesByMonth.map(average)
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

  activeClimateKey = key;
  const requestId = ++climateRequestId;
  const climateMetrics = $("climateMetrics");
  const climateChart = $("climateChart");
  const refreshButton = $("refreshClimate");

  climateMetrics.classList.add("hidden");
  climateChart.classList.add("hidden");
  refreshButton.classList.add("hidden");
  $("climateStatus").textContent = "Loading NASA POWER climate data…";

  requestClimateData(site)
    .then(data => {
      climateCache.set(key, data);
      if (requestId !== climateRequestId || activeClimateKey !== key) return;
      renderClimateData(data);
    })
    .catch(error => {
      if (requestId !== climateRequestId || activeClimateKey !== key) return;
      $("climateStatus").textContent =
        "Climate data unavailable. Check your connection and retry.";
      refreshButton.classList.remove("hidden");
      console.error("Could not load NASA POWER climate data.", error);
    });
}

function renderClimateData(data) {
  $("climateStatus").textContent =
    `NASA POWER daily grid-cell averages for ${CLIMATE_YEAR}; local conditions may differ.`;
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
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    element.textContent = text;
    svg.appendChild(element);
    return element;
  };

  addElement("title", {}, `Monthly mean air temperature in ${CLIMATE_YEAR}`);

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

  const points = values.map((value, index) => ({
    x: left + plotWidth * index / (values.length - 1),
    y: top + plotHeight * (1 - (value - low) / range),
    value
  }));

  addElement("polyline", {
    points: points.map(point => `${point.x},${point.y}`).join(" "),
    class: "chart-line"
  });

  points.forEach((point, index) => {
    const circle = addElement("circle", {
      cx: point.x, cy: point.y, r: 2.5, class: "chart-point"
    });
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent =
      `${MONTHS[index][1]} ${CLIMATE_YEAR}: ${point.value.toFixed(1)} °C`;
    circle.appendChild(title);
    addElement("text", {
      x: point.x, y: height - 8, "text-anchor": "middle", class: "chart-month"
    }, MONTHS[index][1]);
  });

  const label = document.createElement("p");
  label.textContent = `${CLIMATE_YEAR} MONTHLY MEAN AIR TEMPERATURE · °C`;
  chart.replaceChildren(label, svg);
  chart.classList.remove("hidden");
}

/* ------------------------------------------------------------------ *
 * Global Earth grid search (existing sidebar workflow)
 * ------------------------------------------------------------------ */

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

function syncTargetLabels() {
  const target = gridTarget();
  $("matrixTemperatureTarget").textContent = `${target.temperature} °C`;
  $("matrixElevationTarget").textContent = `${target.elevation.toLocaleString()} m`;
  $("matrixSlopeTarget").textContent = `${target.slope}°`;
  $("matrixAridityTarget").textContent = `${target.aridity} / 10`;
}

function initGridSearch() {
  const sliderBindings = [
    ["gridTemperature", "gridTemperatureValue", value => `${value} °C`],
    ["gridElevation", "gridElevationValue", value => `${Number(value).toLocaleString()} m`],
    ["gridSlope", "gridSlopeValue", value => `${value}°`],
    ["gridAridity", "gridAridityValue", value => `${value} / 10`],
    ["weightTemperature", "weightTemperatureValue", value => `${value}×`],
    ["weightElevation", "weightElevationValue", value => `${value}×`],
    ["weightSlope", "weightSlopeValue", value => `${value}×`],
    ["weightAridity", "weightAridityValue", value => `${value}×`]
  ];

  sliderBindings.forEach(([inputId, outputId, format]) => {
    const input = $(inputId);
    const output = $(outputId);
    input.addEventListener("input", () => {
      output.textContent = format(input.value);
      syncTargetLabels();
    });
    output.textContent = format(input.value);
  });
  syncTargetLabels();

  $("quadrangleSelect").addEventListener("change", event => {
    if (event.target.value) selectQuadrangle(event.target.value);
  });
  $("run-analysis").addEventListener("click", runAnalysis);

  try {
    gridWorker = new Worker("./assets/js/searchWorker.js");
  } catch (error) {
    $("gridSearchStatus").textContent =
      `Could not start the search worker: ${error.message}. Serve this page over HTTP.`;
    return;
  }

  gridWorker.addEventListener("message", event => {
    const { type } = event.data;

    if (type === "READY") {
      gridReady = true;
      $("gridSearchBtn").disabled = false;
      const coverage = event.data.latitudeCoverage;
      $("gridSearchStatus").textContent =
        `Grid ready · ${event.data.count.toLocaleString()} source-covered land tiles · ` +
        `${(event.data.resolutionMeters / 1000).toFixed(0)} km equal-area · ` +
        `${event.data.sourcePeriod} climate snapshot · latitude ` +
        `${coverage.minimum.toFixed(1)} to ${coverage.maximum.toFixed(1)}°.`;
      const coverageNote =
        `Coverage: source-complete land cells between ${coverage.minimum.toFixed(1)}° ` +
        `and ${coverage.maximum.toFixed(1)}° latitude; cells with missing inputs are omitted.`;
      $("gridSourceDetails").textContent = event.data.citations.length
        ? `${coverageNote} Sources: ${event.data.citations.join(" · ")}`
        : `${coverageNote} Source citations were not included with this grid.`;
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
      $("gridSearchStatus").textContent = event.data.message;
      console.error("Global grid search failed:", event.data.message);
    }
  });

  gridWorker.addEventListener("error", event => {
    $("gridSearchBtn").disabled = true;
    $("gridSearchStatus").textContent = `Global grid worker failed: ${event.message}`;
  });

  $("gridSearchBtn").addEventListener("click", () => {
    $("gridSearchBtn").disabled = true;
    $("gridSearchStatus").textContent = "Scanning the global land grid…";
    gridWorker.postMessage({ type: "SCAN", target: gridTarget() });
  });

  gridWorker.postMessage({ type: "LOAD_DATA" });
}

function renderGridResults(results) {
  gridMarkers.forEach(marker => marker.remove());
  gridMarkers = [];
  gridScanResults = results;
  selectedGridCandidate = results[0] || null;
  $("gridResults").replaceChildren();
  const globe = $("map");

  results.forEach((result, index) => {
    const coordinates = `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "grid-result";
    button.textContent = [
      `${String(index + 1).padStart(2, "0")} · ${coordinates} · ${result.score}%`,
      `${result.temperature.toFixed(1)} °C · ${Math.round(result.elevation).toLocaleString()} m · ` +
      `${result.slope.toFixed(1)}° · ${result.aridity.toFixed(1)} / 10`
    ].join("\n");
    button.addEventListener("click", () => {
      selectGridCandidate(result);
    });
    item.appendChild(button);
    $("gridResults").appendChild(item);

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `marker global-marker${index === 0 ? " global-best" : ""}`;
    marker.slot = `hotspot-grid-result-${index + 1}`;
    const position = globePosition({ lat: result.latitude, lon: result.longitude });
    marker.dataset.position = position.position;
    marker.dataset.normal = position.normal;
    marker.dataset.visibilityAttribute = "visible";
    marker.title = `Grid match ${index + 1} · ${result.score}% · ${coordinates}`;
    marker.setAttribute("aria-label", marker.title);
    marker.addEventListener("click", () => {
      selectGridCandidate(result);
    });
    globe.appendChild(marker);
    gridMarkers.push(marker);
  });
  renderAnalogCandidates();
  updateModisControls();
}

function gridCandidateId(result) {
  return `${result.latitude.toFixed(4)},${result.longitude.toFixed(4)}`;
}

function selectGridCandidate(result) {
  selectedGridCandidate = result;
  const coordinates = `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
  selectedAnalogue = { lat: result.latitude, lon: result.longitude };
  focusSite(selectedAnalogue);
  $("coordinates").textContent = `GRID CELL · ${coordinates}`;
  $("modisStatus").textContent =
    `Selected ${coordinates}. MODIS requests are optional and do not affect the scan score.`;
  updateModisControls();
}

function renderAnalogCandidates() {
  const list = $("analogsCatalog");
  if (!list) return;
  list.replaceChildren();
  $("analogsCandidateStatus").textContent = gridScanResults.length
    ? `${gridScanResults.length} ranked cells from the latest browser scan.`
    : "Run a global scan to see ranked cells here.";

  gridScanResults.forEach((result, index) => {
    const item = document.createElement("li");
    item.className = "analog-grid-card";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Inspect scan candidate ${index + 1} on the globe`);
    const heading = document.createElement("strong");
    heading.textContent =
      `GRID CANDIDATE · ${String(index + 1).padStart(2, "0")} · ${result.score}% relative score`;
    const location = document.createElement("span");
    location.textContent =
      `${result.latitude.toFixed(2)}°, ${result.longitude.toFixed(2)}°`;
    const fields = document.createElement("span");
    fields.textContent =
      `${result.temperature.toFixed(1)} °C · ${Math.round(result.elevation).toLocaleString()} m · ` +
      `${result.slope.toFixed(1)}° slope · ${result.aridity.toFixed(1)} / 10 aridity`;
    button.append(heading, location, fields);
    button.addEventListener("click", () => {
      showPage("atlasView");
      selectGridCandidate(result);
    });
    item.appendChild(button);
    list.appendChild(item);
  });
}

function updateModisControls() {
  const hasSelection = Boolean(selectedGridCandidate);
  $("loadSelectedModis").disabled = !hasSelection || modisRequestActive;
  $("loadTopTenModis").disabled = gridScanResults.length === 0 || modisRequestActive;
}

function parseModisSamples(payload) {
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

async function fetchModisWindow(candidate, band, startDate, endDate) {
  const url = new URL(`${API_URL}/api/modis`);
  url.search = new URLSearchParams({
    latitude: String(candidate.latitude),
    longitude: String(candidate.longitude),
    band,
    window: `${startDate}:${endDate}`
  }).toString();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`MODIS service returned a non-JSON response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || `MODIS request failed (HTTP ${response.status}).`);
    }
    return parseModisSamples(payload);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("MODIS request timed out after 90 seconds.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function fetchModisForCandidate(candidate) {
  const key = gridCandidateId(candidate);
  if (modisCache.has(key)) return modisCache.get(key);
  const request = Promise.all(MODIS_BANDS.map(band =>
    Promise.all(MODIS_WINDOWS.map(([startDate, endDate]) =>
      fetchModisWindow(candidate, band, startDate, endDate)
    ))
  )).then(([dayWindows, nightWindows]) => {
    const day = dayWindows.flat();
    const night = nightWindows.flat();
    const average = values => values.reduce((total, value) => total + value, 0) / values.length;
    if (!day.length || !night.length) {
      throw new Error("ORNL MODIS returned incomplete day/night samples.");
    }
    return {
      candidate,
      dayC: average(day) - 273.15,
      nightC: average(night) - 273.15,
      rangeC: average(day) - average(night),
      sampleCount: day.length + night.length,
      source: "MODIS MOD11A2 via ORNL DAAC"
    };
  });
  modisCache.set(key, request);
  request.catch(() => modisCache.delete(key));
  return request;
}

function renderModisMetrics(summaries) {
  const container = $("modisMetrics");
  container.replaceChildren();
  summaries.forEach(summary => {
    const card = document.createElement("div");
    card.className = "modis-metric";
    const heading = document.createElement("span");
    heading.textContent =
      `${summary.candidate.latitude.toFixed(2)}°, ${summary.candidate.longitude.toFixed(2)}° · ` +
      `${summary.sampleCount} valid samples`;
    const day = document.createElement("strong");
    day.textContent = `Day mean ${summary.dayC.toFixed(1)} °C`;
    const night = document.createElement("strong");
    night.textContent = `Night mean ${summary.nightC.toFixed(1)} °C`;
    const range = document.createElement("strong");
    range.textContent = `Day − night ${summary.rangeC.toFixed(1)} °C`;
    card.append(heading, day, night, range);
    container.appendChild(card);
  });
  container.classList.toggle("hidden", summaries.length === 0);
}

async function loadSelectedModis() {
  if (!selectedGridCandidate || modisRequestActive) return;
  modisRequestActive = true;
  updateModisControls();
  const selected = selectedGridCandidate;
  $("modisStatus").textContent =
    `Requesting two day/night seasonal windows for ${selected.latitude.toFixed(2)}°, ${selected.longitude.toFixed(2)}°…`;
  try {
    const summary = await fetchModisForCandidate(selected);
    renderModisMetrics([summary]);
    $("modisStatus").textContent =
      `${summary.source} · 2025 day-of-year windows 001–073 and 177–249. ` +
      "Surface temperature is separate from the grid's air-temperature field and was not used for ranking.";
  } catch (error) {
    $("modisStatus").textContent =
      `MODIS sample unavailable: ${error instanceof Error ? error.message : String(error)}`;
    console.error("MODIS sample request failed.", error);
  } finally {
    modisRequestActive = false;
    updateModisControls();
  }
}

async function loadTopTenModis() {
  if (!gridScanResults.length || modisRequestActive) return;
  modisRequestActive = true;
  updateModisControls();
  const candidates = gridScanResults.slice(0, 10);
  const summaries = [];
  let failures = 0;
  renderModisMetrics([]);
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    $("modisStatus").textContent =
      `Loading MODIS for candidate ${index + 1} of ${candidates.length}. ` +
      "Four upstream samples are requested per cell; allow time for the service.";
    try {
      summaries.push(await fetchModisForCandidate(candidate));
      renderModisMetrics(summaries);
    } catch (error) {
      failures += 1;
      console.error(`MODIS request failed for candidate ${index + 1}.`, error);
    }
  }
  $("modisStatus").textContent = summaries.length
    ? `${summaries.length} candidate(s) returned MODIS samples; ${failures} failed. ` +
      "2025 surface-temperature context only; not used for ranking."
    : `No MODIS samples were returned (${failures} request failure${failures === 1 ? "" : "s"}).`;
  modisRequestActive = false;
  updateModisControls();
}

function appendProfileParameters(container, parameters) {
  container.replaceChildren();
  parameters.forEach(parameter => {
    const term = document.createElement("dt");
    term.textContent = parameter.name;
    const value = document.createElement("dd");
    value.append(document.createTextNode(parameter.value));
    const metadata = [parameter.confidence, parameter.agency]
      .filter(Boolean)
      .join(" · ");
    if (metadata) {
      value.append(document.createElement("br"), document.createTextNode(metadata));
    }
    if (typeof parameter.sourceUrl === "string" && parameter.sourceUrl.startsWith("https://")) {
      const link = document.createElement("a");
      link.href = parameter.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = parameter.sourceTitle || "Open field source ↗";
      value.append(document.createElement("br"), link);
    }
    container.append(term, value);
  });
}

function renderCuratedProfile(profile) {
  const article = $("curatedProfileDetails");
  if (!profile) {
    selectedCuratedProfileId = null;
    article.classList.add("hidden");
    return;
  }
  selectedCuratedProfileId = profile.id;
  $("curatedProfileName").textContent = `${profile.body} · ${profile.name}`;
  $("curatedProfileSummary").textContent =
    `${profile.terrainTypes.join(" · ")} · ${profile.parameters.length} workbook-labeled measured reference fields. ` +
    "These references are not scored against the Earth grid and selecting one does not change scan parameters.";
  appendProfileParameters($("curatedProfileParameters"), profile.parameters);
  $("curatedProfileSourceNote").textContent =
    profile.body === "Moon"
      ? "Profile-level citations are retained from the workbook; individual fields are not independently cited."
      : "Field citations are retained from the workbook; links have not been independently revalidated at runtime.";
  const sourceList = $("curatedProfileSources");
  sourceList.replaceChildren();
  profile.sources.forEach(source => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.title || source.url;
    item.appendChild(link);
    sourceList.appendChild(item);
  });
  $("curatedProfileSourcesPanel").querySelector("summary").textContent =
    `Show ${profile.sources.length} profile citation${profile.sources.length === 1 ? "" : "s"}`;
  article.classList.remove("hidden");
  renderCuratedProfileList();
}

function renderCuratedProfileList() {
  const list = $("curatedProfileList");
  const search = $("curatedProfileSearch").value.trim().toLocaleLowerCase();
  const body = $("curatedProfileBody").value;
  const filtered = curatedProfiles.filter(profile =>
    (body === "all" || profile.body === body) &&
    `${profile.name} ${profile.terrainTypes.join(" ")}`.toLocaleLowerCase().includes(search)
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / CURATED_PROFILES_PER_PAGE));
  curatedProfilePage = Math.min(curatedProfilePage, pageCount - 1);
  const start = curatedProfilePage * CURATED_PROFILES_PER_PAGE;
  const pageProfiles = filtered.slice(start, start + CURATED_PROFILES_PER_PAGE);
  list.replaceChildren();
  pageProfiles.forEach(profile => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "curated-profile-choice";
    button.classList.toggle("active", profile.id === selectedCuratedProfileId);
    button.setAttribute("aria-pressed", String(profile.id === selectedCuratedProfileId));
    button.textContent = profile.name;
    const metadata = document.createElement("span");
    metadata.textContent = `${profile.body} · ${profile.terrainTypes.join(", ")}`;
    button.appendChild(metadata);
    button.addEventListener("click", () => renderCuratedProfile(profile));
    list.appendChild(button);
  });
  $("curatedProfilePageStatus").textContent = filtered.length
    ? `${start + 1}–${Math.min(start + pageProfiles.length, filtered.length)} of ${filtered.length}`
    : "No matching profiles";
  $("curatedProfilePrevious").disabled = curatedProfilePage === 0;
  $("curatedProfileNext").disabled = curatedProfilePage >= pageCount - 1;
  $("curatedProfileStatus").textContent =
    `${curatedProfiles.length} source-linked reference profiles · 20 names per page. ` +
    "Workbook labels and citations are not independent validation.";
}

async function loadCuratedProfiles() {
  if (curatedProfiles.length) return true;
  if (curatedProfilesLoad) return curatedProfilesLoad;
  curatedProfilesLoad = (async () => {
    const status = $("curatedProfileStatus");
    status.textContent = "Loading cited reference profiles…";
    try {
      const response = await fetch("./assets/media/curated_reference_profiles.json");
      if (!response.ok) {
        throw new Error(`Reference profile request failed (HTTP ${response.status}).`);
      }
      const data = await response.json();
      const valid = data?.schemaVersion === 1 &&
        Array.isArray(data.profiles) && data.profiles.length > 0 &&
        data.profiles.every(profile =>
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
        );
      if (!valid) throw new Error("Reference profile file has an unsupported or empty format.");
      curatedProfiles = data.profiles;
      $("curatedProfileSearch").disabled = false;
      $("curatedProfileBody").disabled = false;
      renderCuratedProfileList();
      const excluded = $("curatedProfileExclusions");
      excluded.replaceChildren();
      (data.excludedWorkbooks || []).forEach(workbook => {
        const item = document.createElement("li");
        item.textContent = `${workbook.file}: ${workbook.reason}`;
        excluded.appendChild(item);
      });
      return true;
    } catch (error) {
      curatedProfilesLoad = null;
      status.textContent =
        `Curated references unavailable: ${error instanceof Error ? error.message : String(error)}`;
      console.error("Could not load curated reference profiles.", error);
      return false;
    }
  })();
  return curatedProfilesLoad;
}

function initAnalogPage() {
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
  $("loadSelectedModis").addEventListener("click", loadSelectedModis);
  $("loadTopTenModis").addEventListener("click", loadTopTenModis);
  $("roverExampleReset").addEventListener("click", () => {
    const model = $("roverExampleModel");
    model.cameraOrbit = "35deg 70deg 5m";
    model.jumpCameraToGoal();
  });
  $("roverExampleSpin").addEventListener("click", event => {
    const model = $("roverExampleModel");
    const enabled = !model.hasAttribute("auto-rotate");
    model.toggleAttribute("auto-rotate", enabled);
    event.currentTarget.setAttribute("aria-pressed", String(enabled));
    event.currentTarget.textContent = enabled ? "STOP AUTO ROTATE" : "AUTO ROTATE";
  });
}

/* ------------------------------------------------------------------ *
 * Modes, pages, boot
 * ------------------------------------------------------------------ */

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  const planet = PLANETS[mode];

  $("moonBtn").classList.toggle("active", mode === "moon");
  $("marsBtn").classList.toggle("active", mode === "mars");
  $("moon-mode").classList.toggle("active", mode === "moon");
  $("mars-mode").classList.toggle("active", mode === "mars");
  $("moon-mode").setAttribute("aria-pressed", String(mode === "moon"));
  $("mars-mode").setAttribute("aria-pressed", String(mode === "mars"));

  $("modeTitle").textContent = mode === "moon" ? "Moon analogs" : "Mars analogs";
  $("modeDescription").textContent = mode === "mars"
    ? "Select a Mars quadrangle on the flat MC chart to send its coordinates to the analogue model, or set Earth-side targets for the global grid scan."
    : "Select a lunar quadrangle on the flat LQ chart to send its coordinates to the analogue model, or set Earth-side targets for the global grid scan.";

  document.documentElement.style.setProperty(
    "--accent",
    mode === "moon" ? "#facc15" : "#fb7185"
  );

  selectedAnalogue = null;
  $("siteCard").classList.add("hidden");
  $("coordinates").textContent = `DRAG TO ROTATE · ${planet.label.toUpperCase()} QUADRANGLE ANALOGUES`;

  buildQuadrangleMap();
}

const PAGE_IDS = [
  "homeView", "servicesView", "guideView", "atlasView",
  "analogsView", "roverView", "teamView"
];

function pageFromHash() {
  const slug = location.hash.replace("#", "");
  const match = PAGE_IDS.find(id => id.replace("View", "").toLowerCase() === slug);
  return match || "homeView";
}

function showPage(pageId, updateHistory = true) {
  const view = $(pageId);
  if (!view) return;

  document.querySelectorAll(".page-view").forEach(page => {
    const active = page.id === pageId;
    page.classList.toggle("hidden", !active);
    if (active) page.removeAttribute("hidden");
    else page.setAttribute("hidden", "");
  });

  document.querySelectorAll(".site-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const isAppPage = pageId === "atlasView";
  $("moonBtn").closest(".modes").classList.toggle("hidden", !isAppPage);
  document.body.dataset.page = pageId;
  view.querySelectorAll("model-viewer").forEach(model => {
    model.setAttribute("loading", "eager");
  });
  if (pageId === "analogsView") loadCuratedProfiles();

  if (updateHistory) {
    history.replaceState(null, "", `#${pageId.replace("View", "").toLowerCase()}`);
  }
}

$("moonBtn").addEventListener("click", () => setMode("moon"));
$("marsBtn").addEventListener("click", () => setMode("mars"));
$("moon-mode").addEventListener("click", () => setMode("moon"));
$("mars-mode").addEventListener("click", () => setMode("mars"));

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

// Back/forward and inbound #page links should switch views too.
window.addEventListener("hashchange", () => showPage(pageFromHash(), false));

/* ------------------------------------------------------------------ *
 * Landing page: world preview tabs
 * ------------------------------------------------------------------ */

const LANDING_WORLDS = {
  earth: {
    src: "./assets/media/landing-earth.jpg",
    alt: "Earth photographed during the Apollo 17 mission"
  },
  moon: {
    src: "./assets/media/landing-moon.jpg",
    alt: "The Moon photographed by NASA"
  },
  mars: {
    src: "./assets/media/landing-mars.jpg",
    alt: "Mars photographed by NASA"
  }
};

function initLanding() {
  const image = $("landingWorldImage");
  if (!image) return;

  document.querySelectorAll(".world-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const world = LANDING_WORLDS[chip.dataset.world];
      if (!world || image.dataset.world === chip.dataset.world) return;

      document.querySelectorAll(".world-chip").forEach(other => {
        const active = other === chip;
        other.classList.toggle("active", active);
        other.setAttribute("aria-pressed", String(active));
      });

      image.dataset.world = chip.dataset.world;
      image.classList.add("is-swapping");
      window.setTimeout(() => {
        image.src = world.src;
        image.alt = world.alt;
        image.classList.remove("is-swapping");
      }, 170);
    });
  });
}

$("closeCard").addEventListener("click", () => {
  $("siteCard").classList.add("hidden");
  selectedAnalogue = null;
});

$("refreshClimate").addEventListener("click", () => {
  if (selectedAnalogue) loadClimateData(selectedAnalogue, true);
});

$("exportSite").addEventListener("click", () => {
  if (!analogueResult) return;
  const payload = {
    body: analogueResult.body,
    quadrangle: analogueResult.quadrangle,
    quadrangle_name: analogueResult.quadrangle_name,
    quadrangle_bounds: analogueResult.quadrangle_bounds,
    coordinates: analogueResult.coordinates,
    analogues: analogueResult.analogues,
    parameter_details: analogueResult.parameter_details
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `analogues-${String(analogueResult.quadrangle).toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

initGlobe();
initGridSearch();
initLanding();
initAnalogPage();
setMode("moon");
showPage(pageFromHash(), false);
