// Run in the Earth Engine Code Editor with Cloud project nasa-project-514803
// selected. Start the task in the Tasks tab, then download the exported TIFF
// from Google Drive into data/earth_engine/.

var outputProjection = ee.Projection("EPSG:6933");
var transform = [
  15000, 0, -17367530.445161372,
  0, -15000, 7342230.136498678
];
var bounds = ee.Geometry.Rectangle(
  [
    -17367530.445161372,
    -7342769.863501322,
    17372469.554838628,
    7342230.136498678
  ],
  outputProjection,
  false
);

var modis = ee.ImageCollection("MODIS/061/MOD11A2")
  .filterDate("2015-01-01", "2026-01-01")
  .map(function (image) {
    var dayRaw = image.select("LST_Day_1km");
    var nightRaw = image.select("LST_Night_1km");
    var dayQc = image.select("QC_Day").bitwiseAnd(3).eq(0);
    var nightQc = image.select("QC_Night").bitwiseAnd(3).eq(0);
    var day = dayRaw.updateMask(dayQc)
      .updateMask(dayRaw.gte(7500).and(dayRaw.lte(65535)))
      .multiply(0.02).subtract(273.15).rename("modis_day_lst_c");
    var night = nightRaw.updateMask(nightQc)
      .updateMask(nightRaw.gte(7500).and(nightRaw.lte(65535)))
      .multiply(0.02).subtract(273.15).rename("modis_night_lst_c");
    return day.addBands(night);
  });

var dayLstAt1Km = modis.select("modis_day_lst_c").mean()
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: "EPSG:6933", scale: 1000});
var nightLstAt1Km = modis.select("modis_night_lst_c").mean()
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: "EPSG:6933", scale: 1000});

var nasaDem = ee.Image("NASA/NASADEM_HGT/001");
var landDem = nasaDem.select("elevation")
  .updateMask(nasaDem.select("swb").eq(0));
var demAt100m = landDem
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: "EPSG:6933", scale: 100});
var slopeAt100m = ee.Terrain.slope(demAt100m);
var demAt1Km = landDem
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: "EPSG:6933", scale: 1000});
var slopeAt1Km = slopeAt100m
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: "EPSG:6933", scale: 1000});

var layers = dayLstAt1Km
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({crs: outputProjection, crsTransform: transform})
  .rename("modis_day_lst_c")
  .addBands(nightLstAt1Km
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 1024
    })
    .reproject({crs: outputProjection, crsTransform: transform})
    .rename("modis_night_lst_c"))
  .addBands(demAt1Km
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 1024
    })
    .reproject({crs: outputProjection, crsTransform: transform})
    .rename("nasadem_elevation_m"))
  .addBands(slopeAt1Km
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 1024
    })
    .reproject({crs: outputProjection, crsTransform: transform})
    .rename("nasadem_slope_100m_deg"));

Export.image.toDrive({
  image: layers,
  description: "otherworld_atlas_nasa_earth_2015_2025",
  folder: "OtherworldAtlas",
  fileNamePrefix: "nasa_earth_layers_2015_2025",
  region: bounds,
  crs: "EPSG:6933",
  crsTransform: transform,
  maxPixels: 1e13,
  fileFormat: "GeoTIFF"
});

Map.setCenter(0, 0, 2);
