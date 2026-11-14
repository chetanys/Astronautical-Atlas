const GRID_ROWS = 720;
const GRID_COLUMNS = 1440;
const VALUES_PER_CELL = 4;
const RESULT_LIMIT = 10;
const EXPECTED_BYTES =
  GRID_ROWS * GRID_COLUMNS * VALUES_PER_CELL * Float32Array.BYTES_PER_ELEMENT;
const FIELD_RANGES = {
  temperature: 130,
  elevation: 9500,
  slope: 90,
  aridity: 10
};

let grid = null;
let validCellCount = 0;

async function loadGrid() {
  const [gridResponse, metadataResponse] = await Promise.all([
    fetch(new URL("./assets/earth_grid.bin", self.location.href)),
    fetch(new URL("./assets/earth_grid.json", self.location.href))
  ]).catch(error => {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Global grid data or its source metadata is missing${detail}. ` +
      "Generate assets/earth_grid.bin and assets/earth_grid.json using the README instructions, " +
      "then serve the site over HTTP. The named-site explorer is still available."
    );
  });

  if (!gridResponse.ok || !metadataResponse.ok) {
    const status = !gridResponse.ok
      ? gridResponse.status
      : metadataResponse.status;
    throw new Error(
      `Global grid data or source metadata is unavailable (HTTP ${status}). ` +
      "Generate both grid assets using the README instructions. " +
      "The named-site explorer is still available."
    );
  }

  let buffer;
  let metadata;
  try {
    [buffer, metadata] = await Promise.all([
      gridResponse.arrayBuffer(),
      metadataResponse.json()
    ]);
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Could not read the global grid assets${detail}. Rebuild both grid files.`
    );
  }

  if (buffer.byteLength !== EXPECTED_BYTES) {
    throw new Error(
      `Global grid has ${buffer.byteLength} bytes; expected ${EXPECTED_BYTES}. ` +
      "Rebuild assets/earth_grid.bin."
    );
  }

  if (
    metadata?.rows !== GRID_ROWS ||
    metadata?.columns !== GRID_COLUMNS ||
    !Array.isArray(metadata?.citations)
  ) {
    throw new Error(
      "Grid source metadata is invalid or does not match the binary. " +
      "Rebuild both grid assets."
    );
  }

  grid = new Float32Array(buffer);
  for (let offset = 0; offset < grid.length; offset += VALUES_PER_CELL) {
    if (
      Number.isFinite(grid[offset]) &&
      Number.isFinite(grid[offset + 1]) &&
      Number.isFinite(grid[offset + 2]) &&
      Number.isFinite(grid[offset + 3])
    ) {
      validCellCount += 1;
    }
  }

  if (validCellCount === 0) {
    grid = null;
    throw new Error("Global grid contains no valid land cells.");
  }

  self.postMessage({
    type: "READY",
    count: validCellCount,
    citations: metadata.citations
  });
}

function scanGrid(target) {
  if (!grid) {
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
  for (let cell = 0; cell < GRID_ROWS * GRID_COLUMNS; cell += 1) {
    const offset = cell * VALUES_PER_CELL;
    const temperature = grid[offset];
    const elevation = grid[offset + 1];
    const slope = grid[offset + 2];
    const aridity = grid[offset + 3];
    if (
      !Number.isFinite(temperature) ||
      !Number.isFinite(elevation) ||
      !Number.isFinite(slope) ||
      !Number.isFinite(aridity)
    ) {
      continue;
    }

    const normalizedError = (
      Math.abs(temperature - target.temperature) / FIELD_RANGES.temperature +
      Math.abs(elevation - target.elevation) / FIELD_RANGES.elevation +
      Math.abs(slope - target.slope) / FIELD_RANGES.slope +
      Math.abs(aridity - target.aridity) / FIELD_RANGES.aridity
    ) / VALUES_PER_CELL;
    const candidate = {
      cell,
      score: Math.max(0, Math.round((1 - normalizedError) * 100)),
      temperature,
      elevation,
      slope,
      aridity
    };

    const position = results.findIndex(existing =>
      candidate.score > existing.score ||
      (candidate.score === existing.score && candidate.cell < existing.cell)
    );
    if (position === -1) {
      if (results.length < RESULT_LIMIT) results.push(candidate);
    } else {
      results.splice(position, 0, candidate);
      if (results.length > RESULT_LIMIT) results.pop();
    }
  }

  return results.map(result => {
    const row = Math.floor(result.cell / GRID_COLUMNS);
    const column = result.cell % GRID_COLUMNS;
    return {
      latitude: 90 - (row + 0.5) * 0.25,
      longitude: -180 + (column + 0.5) * 0.25,
      score: result.score,
      temperature: result.temperature,
      elevation: result.elevation,
      slope: result.slope,
      aridity: result.aridity
    };
  });
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
        validCellCount,
        totalCellCount: GRID_ROWS * GRID_COLUMNS
      });
    } else {
      throw new Error(`Unknown worker message: ${event.data.type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: "ERROR", message });
  }
});
