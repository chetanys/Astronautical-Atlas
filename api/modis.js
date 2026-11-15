const ORNL_URL = "https://modis.ornl.gov/rst/api/v1/MOD11A2/subset";
const ALLOWED_BANDS = new Set(["LST_Day_1km", "LST_Night_1km"]);
const ALLOWED_WINDOWS = new Set([
  "A2023001:A2023073",
  "A2023177:A2023249"
]);

function isValidCoordinate(value, minimum, maximum) {
  if (typeof value !== "string" || value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const { latitude, longitude, band, window: dateWindow } = request.query;
  if (
    !isValidCoordinate(latitude, -90, 90) ||
    !isValidCoordinate(longitude, -180, 180) ||
    !ALLOWED_BANDS.has(band) ||
    !ALLOWED_WINDOWS.has(dateWindow)
  ) {
    return response.status(400).json({ error: "Invalid MODIS query parameters." });
  }

  const [startDate, endDate] = dateWindow.split(":");
  const upstream = new URL(ORNL_URL);
  upstream.search = new URLSearchParams({
    latitude,
    longitude,
    band,
    startDate,
    endDate,
    kmAboveBelow: "3",
    kmLeftRight: "3"
  }).toString();

  try {
    const result = await fetch(upstream, {
      headers: { Accept: "application/json" }
    });
    response.setHeader("Content-Type", result.headers.get("content-type") || "application/json");
    if (!result.ok) {
      response.setHeader("Cache-Control", "no-store");
      const body = await result.text();
      return response.status(result.status).send(body);
    }
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    return response.status(200).send(await result.text());
  } catch (error) {
    console.error("ORNL MODIS request failed.", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({ error: "ORNL MODIS service is unavailable." });
  }
};
