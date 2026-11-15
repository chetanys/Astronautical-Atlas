const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const gridPath = path.join(root, "assets/earth_grid.bin");
const metadataPath = path.join(root, "assets/earth_grid.json");
const sitesPath = path.join(root, "assets/known_sites.csv");
const reportPath = path.join(root, "assets/known_sites_validation.json");
const fields = ["temperature", "elevation", "slope", "aridity"];
const offsets = { temperature: 2, elevation: 3, slope: 4, aridity: 5 };
const values = {
  temperature: Number(process.env.TARGET_TEMPERATURE ?? -10),
  elevation: Number(process.env.TARGET_ELEVATION ?? 1800),
  slope: Number(process.env.TARGET_SLOPE ?? 15),
  aridity: Number(process.env.TARGET_ARIDITY ?? 8)
};
const defaultWeights = Object.fromEntries(fields.map(field => [field, 1]));

function parseCsvRow(line) {
  return line.split(",");
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const radians = Math.PI / 180;
  const latitudeDelta = (lat2 - lat1) * radians;
  const longitudeDelta = (lon2 - lon1) * radians;
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(lat1 * radians) * Math.cos(lat2 * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function percentileRank(sorted, value) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return 100 * low / sorted.length;
}

function rankGrid(grid, metadata, weights) {
  const weightTotal = fields.reduce((total, field) => total + weights[field], 0);
  const ranked = [];
  for (let offset = 0; offset < grid.length; offset += metadata.recordStride) {
    let distance = 0;
    for (const field of fields) {
      distance += weights[field] *
        Math.abs(grid[offset + offsets[field]] - values[field]) /
        metadata.scoreScales[field];
    }
    ranked.push({
      key: `${grid[offset].toFixed(4)},${grid[offset + 1].toFixed(4)}`,
      distance: distance / weightTotal
    });
  }
  ranked.sort((first, second) =>
    first.distance - second.distance || first.key.localeCompare(second.key)
  );
  return ranked.slice(0, 20).map(candidate => candidate.key);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const binary = fs.readFileSync(gridPath);
const grid = new Float32Array(
  binary.buffer,
  binary.byteOffset,
  binary.byteLength / Float32Array.BYTES_PER_ELEMENT
);
if (grid.length !== metadata.pointCount * metadata.recordStride) {
  throw new Error("Earth grid record count does not match its metadata.");
}

const records = [];
const distributions = Object.fromEntries(fields.map(field => [field, []]));
for (let offset = 0; offset < grid.length; offset += metadata.recordStride) {
  const record = {
    latitude: grid[offset],
    longitude: grid[offset + 1],
    temperature: grid[offset + offsets.temperature],
    elevation: grid[offset + offsets.elevation],
    slope: grid[offset + offsets.slope],
    aridity: grid[offset + offsets.aridity]
  };
  records.push(record);
  fields.forEach(field => distributions[field].push(record[field]));
}
Object.values(distributions).forEach(values => values.sort((a, b) => a - b));

const lines = fs.readFileSync(sitesPath, "utf8").trim().split(/\r?\n/);
const headers = parseCsvRow(lines.shift());
const sites = lines.map(line =>
  Object.fromEntries(headers.map((header, index) =>
    [header, parseCsvRow(line)[index]]
  ))
);
const validation = sites.map(site => {
  const latitude = Number(site.latitude);
  const longitude = Number(site.longitude);
  let nearest = null;
  let nearestDistance = Infinity;
  records.forEach(record => {
    const distance = haversineDistanceKm(
      latitude, longitude, record.latitude, record.longitude
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = record;
    }
  });
  const feature = site.validation_feature;
  const rank = percentileRank(distributions[feature], nearest[feature]);
  const topPercent = site.direction === "high" ? 100 - rank : rank;
  const coordinateWithinOneCell =
    nearestDistance <= metadata.cellSizeMeters / 1000;
  return {
    ...site,
    nearestTile: {
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      distanceKm: nearestDistance,
      temperatureC: nearest.temperature,
      elevationM: nearest.elevation,
      slopeDegrees: nearest.slope,
      aridity0To10: nearest.aridity
    },
    test: {
      feature,
      direction: site.direction,
      percentile: rank,
      topPercent,
      passesTopFivePercent: topPercent <= 5,
      coordinateWithinOneCell,
      passesValidation: topPercent <= 5 && coordinateWithinOneCell
    }
  };
});

const overlapTests = [];
const baselineTop20 = rankGrid(grid, metadata, defaultWeights);
for (const field of fields) {
  for (const factor of [0.8, 1.2]) {
    const weights = { ...defaultWeights, [field]: factor };
    const perturbed = new Set(rankGrid(grid, metadata, weights));
    const overlap = baselineTop20.filter(key => perturbed.has(key)).length;
    overlapTests.push({
      field,
      weight: factor,
      top20OverlapCount: overlap,
      top20OverlapPercent: overlap * 5
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  earthGrid: {
    pointCount: metadata.pointCount,
    cellSizeMeters: metadata.cellSizeMeters,
    sourcePeriod: metadata.sourcePeriod,
    citations: metadata.citations
  },
  method: {
    coordinateSampling: "Nearest source-covered tile to approximate supplied coordinates; haversine distance.",
    percentile: "Empirical percentile over every source-covered Earth grid tile for the selected feature.",
    passThreshold: "Expected-direction feature lies in its top 5% of the current grid distribution and the nearest tile center is within one cell width.",
    coordinateThreshold: `Nearest tile center is at most ${metadata.cellSizeMeters / 1000} km from the approximate coordinate.`,
    scoreSensitivity: "Hold default targets constant; perturb each individual field weight from 1.0 to 0.8 and 1.2, then compare top-20 tile identity with the unperturbed result."
  },
  validation,
  weightSensitivity: {
    baselineWeights: defaultWeights,
    targetValues: values,
    tests: overlapTests,
    minimumTop20OverlapPercent: Math.min(
      ...overlapTests.map(test => test.top20OverlapPercent)
    )
  }
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const failed = validation.filter(site => !site.test.passesValidation);
console.log(`Validated ${validation.length} approximate coordinate samples against ${metadata.pointCount} Earth tiles.`);
validation.forEach(site => {
  console.log(
    `${site.name}: ${site.test.feature} ${site.test.direction}, ` +
    `top ${site.test.topPercent.toFixed(2)}% ` +
    `${site.test.passesValidation
      ? "PASS"
      : site.test.coordinateWithinOneCell
        ? "FAIL"
        : "TOO FAR"}`
  );
});
console.log(
  `Weight sensitivity: minimum top-20 overlap ` +
  `${report.weightSensitivity.minimumTop20OverlapPercent.toFixed(0)}%.`
);
console.log(`Full report: ${path.relative(root, reportPath)}`);
if (failed.length) {
  console.log(`${failed.length} site checks missed the feature threshold or were too far from a source-covered tile.`);
}
