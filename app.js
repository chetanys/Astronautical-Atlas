
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
let gridMarkers = [];
let selectedSite = null;
let gridWorker = null;
let gridReady = false;
let gridHasResults = false;
let gridScanResults = [];
let selectedSubsystem = "wheels";
let marsReference = null;
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

function gridTarget() {
  return {
    temperature: Number($("gridTemperature").value),
    elevation: Number($("gridElevation").value),
    slope: Number($("gridSlope").value),
    aridity: Number($("gridAridity").value)
  };
}

function renderGridResults(results) {
  gridMarkers.forEach(marker => marker.remove());
  gridMarkers = [];
  gridScanResults = results;
  $("gridResults").replaceChildren();

  results.forEach((result, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const marker = document.createElement("button");
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
      focusSite({ lat: result.latitude, lon: result.longitude });
      $("coordinates").textContent = `GRID CELL · ${coordinates}`;
    });

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
      focusSite({ lat: result.latitude, lon: result.longitude });
      $("coordinates").textContent = `GRID CELL · ${coordinates}`;
    });

    item.appendChild(button);
    $("gridResults").appendChild(item);
    globe.appendChild(marker);
    gridMarkers.push(marker);
  });

  gridHasResults = results.length > 0;
  $("gridMapHint").classList.toggle("hidden", gridHasResults);
  $("gridMapTip").textContent = gridHasResults
    ? "ⓘ Click a ranked result or map marker to inspect its location."
    : "ⓘ Run a scan to place its top matches on the globe.";
  updateRoverCandidates(results);
}

function clearGridResults() {
  gridMarkers.forEach(marker => marker.remove());
  gridMarkers = [];
  $("gridResults").replaceChildren();
  gridHasResults = false;
  gridScanResults = [];
  $("gridMapHint").classList.remove("hidden");
  $("gridMapTip").textContent =
    "ⓘ Run a scan to place its top matches on the globe.";
  updateRoverCandidates([]);
}

const SUBSYSTEMS = {
  wheels: {
    label: "MOBILITY · WHEELS",
    title: "Terrain slope comparison",
    field: "slope",
    targetLabel: "TARGET SLOPE",
    valueLabel: "GRID-CELL SLOPE",
    scale: 90,
    caveat: "Coarse global-grid slope only. This does not measure wheel traction, rock hazards, bearing loads or rover traversability. Confirm using high-resolution terrain data and a regolith simulant bin."
  },
  power: {
    label: "ENERGY · POWER",
    title: "Aridity context only",
    field: "aridity",
    targetLabel: "TARGET ARIDITY",
    valueLabel: "GRID-CELL ARIDITY",
    scale: 10,
    caveat: "Aridity is not solar irradiance or rover power availability. The current grid cannot score power generation, dust accumulation, battery state or energy margin. Direct solar and dust data are not available."
  },
  thermal: {
    label: "ENVIRONMENT · THERMAL",
    title: "Mean temperature comparison",
    field: "temperature",
    targetLabel: "TARGET MEAN TEMP",
    valueLabel: "GRID-CELL MEAN TEMP",
    scale: 130,
    caveat: "Annual mean temperature is a broad climate proxy. It does not represent surface extremes, thermal cycling, vacuum, internal hardware temperatures or qualification limits."
  },
  electronics: {
    label: "AVIONICS · ELECTRONICS / OPTICS",
    title: "Qualification gap unavailable",
    unavailable: true,
    caveat: "The global grid has no radiation, dust optical depth, illumination geometry, lens contamination or subsystem operating thresholds. Use a thermal-vacuum chamber and spotlight / optics rig."
  },
  comms: {
    label: "LINK · COMMUNICATIONS",
    title: "Link analysis unavailable",
    unavailable: true,
    caveat: "The current grid contains no antenna pattern, link budget, relay geometry, terrain obstruction or mission schedule data. No communications coverage claim can be made from this scan."
  }
};

const RISK_REVIEW_SYSTEMS = [
  {
    name: "Wheels / mobility",
    screen: (candidate, target) => candidate
      ? `Grid slope ${candidate.slope.toFixed(1)}°; target ${target.slope.toFixed(1)}° (gap ${Math.abs(candidate.slope - target.slope).toFixed(1)}°).`
      : "Slope comparison requires a scan result.",
    notTested: "Traction, slip, sinkage, wheel loads, rock strikes and traverse safety."
  },
  {
    name: "Chassis / suspension",
    screen: candidate => candidate
      ? `Regional elevation ${candidate.elevation.toFixed(0)} m and grid slope ${candidate.slope.toFixed(1)}° (context only).`
      : "Elevation and slope context requires a scan result.",
    notTested: "Chassis stress, clearance, tipping margin, obstacle geometry and suspension loading."
  },
  {
    name: "Power / energy",
    screen: candidate => candidate
      ? `Aridity ${candidate.aridity.toFixed(1)}/10 is available as a dryness proxy only.`
      : "Aridity proxy requires a scan result.",
    notTested: "Solar/RTG output, battery state, mission energy margin and dust effects."
  },
  {
    name: "Thermal",
    screen: candidate => candidate
      ? `Grid mean temperature ${candidate.temperature.toFixed(1)} °C (broad climate context).`
      : "Mean-temperature comparison requires a scan result.",
    notTested: "Temperature extremes, thermal cycling, vacuum behavior and component limits."
  },
  {
    name: "Electronics / optics",
    screen: () => "No directly relevant radiation, dust-opacity or illumination measurements.",
    notTested: "Radiation dose, dust deposition, camera contamination, optical conditions and electronics limits."
  },
  {
    name: "Communications",
    screen: () => "No direct communications measurements.",
    notTested: "Antenna pattern, link budget, relay availability, terrain blockage and data rate."
  },
  {
    name: "Planetary materials / environment",
    screen: () => "The supplied Moon/Earth dictionaries describe fields; they do not contain measurement rasters for the global scan.",
    notTested: "Mineral and oxide fractions, dust/regolith, ice/water, thermal inertia, pressure, wind, radiation and geological activity."
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

  if (subsystem.unavailable) {
    $("coverageValue").textContent = "NOT SCORED";
    $("coverageBar").style.width = "0%";
    $("coverageBar").className = "unavailable";
    showSubsystemMetrics([
      ["AVAILABLE INPUTS", candidate ? "No subsystem-specific data" : "No scan result"],
      ["ENGINEERING GAP", "Required source data / limits not in prototype"]
    ]);
    $("subsystemCaveat").textContent = subsystem.caveat;
    return;
  }

  if (!candidate) {
    $("coverageValue").textContent = "--";
    $("coverageBar").style.width = "0%";
    $("coverageBar").className = "";
    showSubsystemMetrics([
      ["TARGET", "Set requirements and scan the global grid"],
      ["CANDIDATE", "No result selected"],
      ["GAP", "Not available"]
    ]);
    $("subsystemCaveat").textContent =
      "This is a screening prototype, not a rover qualification model. Run a global scan to compare the selected target with a candidate cell.";
    return;
  }

  const field = subsystem.field;
  const gap = Math.abs(target[field] - candidate[field]);
  const coverage = Math.max(0, Math.round((1 - gap / subsystem.scale) * 100));
  const category = coverage >= 80 ? "good" : coverage >= 50 ? "partial" : "poor";
  const display = field === "temperature"
    ? value => `${value.toFixed(1)} °C`
    : field === "slope"
      ? value => `${value.toFixed(1)}°`
      : value => `${value.toFixed(1)} / 10`;

  $("coverageValue").textContent = `${coverage}% · RELATIVE FIT`;
  $("coverageBar").style.width = `${coverage}%`;
  $("coverageBar").className = category;
  showSubsystemMetrics([
    [subsystem.targetLabel, display(target[field])],
    [subsystem.valueLabel, display(candidate[field])],
    ["ABSOLUTE GAP", display(gap)],
    ["SCREENING BAND", category === "good" ? "Closer match" : category === "partial" ? "Partial match" : "Large mismatch"],
    ["CANDIDATE", `${candidate.latitude.toFixed(2)}°, ${candidate.longitude.toFixed(2)}°`]
  ]);
  $("subsystemCaveat").textContent = subsystem.caveat;
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
    const notTested = document.createElement("td");
    notTested.textContent = system.notTested;
    row.append(name, screen, notTested);
    rows.appendChild(row);
  });
}

function renderAnalogCatalog() {
  const container = $("analogsCatalog");
  if (!container) return;
  container.replaceChildren();

  SITES.forEach(site => {
    const card = document.createElement("article");
    card.className = "analog-card";
    const eyebrow = document.createElement("small");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = site.type === "terrain"
      ? "TERRAIN REFERENCE"
      : "CLIMATE REFERENCE";
    const heading = document.createElement("h2");
    heading.textContent = site.name;
    const location = document.createElement("p");
    location.textContent =
      `${site.country} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°`;
    const environment = document.createElement("strong");
    environment.textContent = site.climate;
    const description = document.createElement("p");
    description.textContent = site.description;
    const action = document.createElement("button");
    action.className = "secondary-action";
    action.type = "button";
    action.textContent = "OPEN IN APPLICATION →";
    action.addEventListener("click", () => {
      showPage("atlasView");
      openSite({ ...site, score: scoreSite(site) });
    });
    card.append(eyebrow, heading, location, environment, description, action);
    container.appendChild(card);
  });
}

function formatReferenceValue(value, unit, decimals = 1) {
  return Number.isFinite(value) ? `${value.toFixed(decimals)} ${unit}` : "Not available";
}

function renderMarsReferenceRows(regions) {
  const body = $("marsReferenceRows");
  body.replaceChildren();

  regions.forEach(region => {
    const row = document.createElement("tr");
    const center = Number.isFinite(region.centerLatitude)
      ? `${region.centerLatitude.toFixed(1)}°, ${
        Number.isFinite(region.centerLongitude)
          ? `${region.centerLongitude.toFixed(1)}°`
          : "all longitudes"
      }`
      : "Not available";
    const values = [
      region.name,
      center,
      formatReferenceValue(region.molaTopographyMeters, "m"),
      formatReferenceValue(region.molaSlopeDegrees, "°"),
      formatReferenceValue(region.spreadsheetMeanAnnualTemperatureC, "°C"),
      formatReferenceValue(region.spreadsheetMeanPressurePa, "Pa", 0)
    ];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

function renderParameterDefinitions(containerId, definition) {
  const container = $(containerId);
  const table = document.createElement("table");
  table.className = "risk-review-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  definition.columns.forEach(column => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column;
    headerRow.appendChild(cell);
  });
  head.appendChild(headerRow);
  const body = document.createElement("tbody");
  definition.rows.forEach(values => {
    const row = document.createElement("tr");
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.append(head, body);
  container.replaceChildren(table);
}

async function loadMarsReference() {
  try {
    const response = await fetch("./assets/mars_reference.json");
    if (!response.ok) {
      throw new Error(`Mars reference data request failed (HTTP ${response.status}).`);
    }
    const reference = await response.json();
    const regions = reference?.marsDataset?.regions;
    if (reference?.schemaVersion !== 1 || !Array.isArray(regions) || !regions.length) {
      throw new Error("Mars reference data has an unsupported or empty format.");
    }

    marsReference = reference;
    const picker = $("marsAnchorRegion");
    picker.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a Mars region (optional)";
    picker.appendChild(placeholder);
    regions.forEach(region => {
      const option = document.createElement("option");
      option.value = region.id;
      option.textContent = region.name;
      picker.appendChild(option);
    });
    picker.disabled = false;
    $("marsDataStatus").textContent =
      `${regions.length} supplied Mars regions · ` +
      `${reference.parameterDefinitions.earth.rows.length} Earth field definitions · ` +
      `${reference.parameterDefinitions.moon.rows.length} lunar field definitions.`;
    renderParameterDefinitions(
      "earthParameterDefinitions",
      reference.parameterDefinitions.earth
    );
    renderParameterDefinitions(
      "lunarParameterDefinitions",
      reference.parameterDefinitions.moon
    );
    $("marsReferenceStatus").textContent =
      "Choose a region to use its MOLA-derived slope as the Earth slope target. " +
      "Other planetary values are shown for context, not scored as Earth equivalents.";
    renderMarsReferenceRows(regions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    $("marsDataStatus").textContent = `Mars source data unavailable: ${message}`;
    $("marsReferenceStatus").textContent =
      "Mars reference data could not be loaded. Manual Earth requirements remain available.";
    console.error("Could not load Mars reference data.", error);
  }
}

function selectMarsAnchor() {
  const region = marsReference?.marsDataset.regions.find(
    item => item.id === $("marsAnchorRegion").value
  );
  if (!region) {
    $("marsReferenceStatus").textContent =
      "No Mars anchor selected. Set each Earth search requirement manually.";
    return;
  }
  if (!Number.isFinite(region.molaSlopeDegrees)) {
    $("marsReferenceStatus").textContent =
      `${region.name} has no usable MOLA slope sample. Set the Earth slope target manually.`;
    return;
  }

  const slopeInput = $("gridSlope");
  slopeInput.value = region.molaSlopeDegrees.toFixed(1);
  slopeInput.dispatchEvent(new Event("input", { bubbles: true }));
  $("marsReferenceStatus").textContent =
    `${region.name}: MOLA slope estimate ${region.molaSlopeDegrees.toFixed(1)}° ` +
    `sets the Earth slope target to ${slopeInput.value}°. This is a coarse terrain ` +
    "comparison only; temperature, pressure, composition, and radiation are not scored.";
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
  $("marsTargetControls").classList.toggle("hidden", mode !== "mars" || pageId !== "atlasView");
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

  const strongMatches =
    visibleSites.filter(site => site.score >= 70).length;

  $("siteCount").textContent =
    String(visibleSites.length).padStart(2, "0");

  $("progressBar").style.width =
    visibleSites.length
      ? `${100 * strongMatches / visibleSites.length}%`
      : "0%";

  $("matchSummary").textContent = visibleSites.length
    ? `${strongMatches} strong matches among ${visibleSites.length} optional named reference sites.`
    : "No reference sites selected. Use the global grid search above to discover locations.";

  if (selectedSite) {
    const updated = visibleSites.find(
      site => site.name === selectedSite.name
    );

    if (updated) {
      openSite(updated, false, false);
    } else {
      selectedSite = { ...selectedSite, score: scoreSite(selectedSite) };
      $("siteScore").textContent = `${selectedSite.score}%`;
      $("siteProgress").style.width = `${selectedSite.score}%`;
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

  $("modeDescription").textContent =
    mode === "mars"
      ? "Set Earth-side requirements or select a Mars region to set a coarse MOLA slope target. The remaining fields are not assumed to be cross-planet equivalents."
      : "Set your surface requirements, then scan Earth's global grid for matching locations.";

  document.documentElement.style.setProperty(
    "--accent",
    mode === "moon" ? "#facc15" : "#fb7185"
  );

  renderFilters();
  selectedSite = null;
  $("sitePicker").value = "";
  $("siteCard").classList.add("hidden");
  updateSiteUrl();
  updateSunCalculator(Number($("sunLatitude").value));
  updateMap();
  $("marsTargetControls").classList.toggle(
    "hidden",
    mode !== "mars" || document.body.dataset.page !== "atlasView"
  );
}

$("marsAnchorRegion").addEventListener("change", selectMarsAnchor);
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
    ? "CLOSE ROVER RISK MANAGEMENT"
    : "OPEN ROVER RISK MANAGEMENT";
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
      ? "Reference visual: the Perseverance assembly. The scenario preset does not change this rover model or assert flight compatibility."
      : "Conceptual lunar-scout scenario only. The Perseverance model remains a visual stand-in; no second rover design or verified capability is represented.";
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

[
  ["gridTemperature", "gridTemperatureValue", value => `${value} °C`],
  ["gridElevation", "gridElevationValue", value => `${Number(value).toLocaleString()} m`],
  ["gridSlope", "gridSlopeValue", value => `${value}°`],
  ["gridAridity", "gridAridityValue", value => `${value} / 10`]
].forEach(([inputId, outputId, format]) => {
  $(inputId).addEventListener("input", () => {
    $(outputId).textContent = format($(inputId).value);
    if (gridHasResults) {
      clearGridResults();
      $("gridSearchStatus").textContent =
        "Requirements changed. Scan again to refresh the results.";
    }
  });
});

$("gridSearchBtn").addEventListener("click", () => {
  if (!gridReady || !gridWorker) return;

  clearGridResults();
  $("gridSearchBtn").disabled = true;
  $("gridSearchStatus").textContent =
    "Scanning the land tiles in the background…";
  gridWorker.postMessage({ type: "SCAN", target: gridTarget() });
});

initGlobe();
renderSitePicker();
updateSunCalculator(Number($("sunLatitude").value));
renderFilters();
updateMap();
initGridSearch();
renderAnalogCatalog();
updateRoverCandidates([]);
loadMarsReference();

const requestedSite = new URLSearchParams(window.location.search).get("site");
const deepLinkedSite = SITES.find(site => site.name === requestedSite);
if (deepLinkedSite) {
  showPage("atlasView", false);
  openSite({ ...deepLinkedSite, score: scoreSite(deepLinkedSite) });
} else {
  const requestedPage = location.hash.slice(1).toLowerCase();
  const pageId = [...document.querySelectorAll(".page-view")]
    .find(view => view.id.replace("View", "").toLowerCase() === requestedPage)?.id;
  if (pageId) showPage(pageId, false);
}
