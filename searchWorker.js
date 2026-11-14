const VALUES_PER_RECORD = 6;
const RESULT_LIMIT = 10;
const FIELD_OFFSETS = {
  temperature: 2,
  elevation: 3,
  slope: 4,
  aridity: 5
};

let grid = null;
let metadata = null;

async function loadGrid() {
  const [gridResponse, metadataResponse] = await Promise.all([
    fetch(new URL("./assets/earth_grid.bin", self.location.href)),
    fetch(new URL("./assets/earth_grid.json", self.location.href))
  ]).catch(error => {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Global grid data or its source metadata is missing${detail}. ` +
      "Build assets/earth_grid.bin and assets/earth_grid.json using the README instructions."
    );
  });

  if (!gridResponse.ok || !metadataResponse.ok) {
    const status = !gridResponse.ok
      ? gridResponse.status
      : metadataResponse.status;
    throw new Error(
      `Global grid data or source metadata is unavailable (HTTP ${status}). ` +
      "Build both grid assets using the README instructions."
    );
  }

  let buffer;
  try {
    [buffer, metadata] = await Promise.all([
      gridResponse.arrayBuffer(),
      metadataResponse.json()
    ]);
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(`Could not read the global grid assets${detail}.`);
  }

  if (
    metadata?.schemaVersion !== 2 ||
    metadata?.recordStride !== VALUES_PER_RECORD ||
    !Number.isInteger(metadata?.pointCount) ||
    metadata.pointCount <= 0 ||
    !Number.isFinite(metadata?.latitudeCoverage?.minimum) ||
    !Number.isFinite(metadata?.latitudeCoverage?.maximum) ||
    !Object.keys(FIELD_OFFSETS).every(field =>
      Number.isFinite(metadata?.scoreScales?.[field]) &&
      metadata.scoreScales[field] > 0
    ) ||
    !Array.isArray(metadata?.citations) ||
    buffer.byteLength !== metadata.pointCount * VALUES_PER_RECORD * Float32Array.BYTES_PER_ELEMENT
  ) {
    throw new Error(
      "Global grid metadata does not match the binary data. Rebuild both grid assets."
    );
  }

  grid = new Float32Array(buffer);
  self.postMessage({
    type: "READY",
    count: metadata.pointCount,
    resolutionMeters: metadata.cellSizeMeters,
    sourcePeriod: metadata.sourcePeriod,
    latitudeCoverage: metadata.latitudeCoverage,
    citations: metadata.citations
  });
}

function scanGrid(target) {
  if (!grid || !metadata) {
    throw new Error("Global grid data has not loaded.");
  }

  const targetValues = [
    target.temperature,
    target.elevation,
    target.slope,
    target.aridity
  ];
  if (!targetValues.every(Number.isFinite)) {
    throw new Error("Search targets must all be finite numbers.");
  }

  const results = [];
  for (let offset = 0; offset < grid.length; offset += VALUES_PER_RECORD) {
    const latitude = grid[offset];
    const longitude = grid[offset + 1];
    const temperature = grid[offset + FIELD_OFFSETS.temperature];
    const elevation = grid[offset + FIELD_OFFSETS.elevation];
    const slope = grid[offset + FIELD_OFFSETS.slope];
    const aridity = grid[offset + FIELD_OFFSETS.aridity];
    const normalizedError = Object.entries(FIELD_OFFSETS).reduce(
      (error, [field, fieldOffset]) =>
        error +
        Math.abs(grid[offset + fieldOffset] - target[field]) /
          metadata.scoreScales[field],
      0
    ) / Object.keys(FIELD_OFFSETS).length;
    const candidate = {
      latitude,
      longitude,
      score: Math.max(0, Math.round((1 - normalizedError) * 100)),
      temperature,
      elevation,
      slope,
      aridity
    };

    const position = results.findIndex(existing =>
      candidate.score > existing.score ||
      (candidate.score === existing.score &&
        (candidate.latitude < existing.latitude ||
          (candidate.latitude === existing.latitude &&
            candidate.longitude < existing.longitude)))
    );
    if (position === -1) {
      if (results.length < RESULT_LIMIT) results.push(candidate);
    } else {
      results.splice(position, 0, candidate);
      if (results.length > RESULT_LIMIT) results.pop();
    }
  }

  return results;
}

self.addEventListener("message", async event => {
  try {
    if (event.data.type === "LOAD_DATA") {
      await loadGrid();
    } else if (event.data.type === "SCAN") {
      const results = scanGrid(event.data.target);
      self.postMessage({
        type: "RESULTS",
        results,
        validCellCount: metadata.pointCount,
        totalCellCount: metadata.candidateGridCells,
        resolutionMeters: metadata.cellSizeMeters
      });
    } else {
      throw new Error(`Unknown worker message: ${event.data.type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: "ERROR", message });
  }
});
