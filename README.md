# Hackathon1

Otherworld Atlas compares Earth locations in Moon and Mars modes. Site profiles
also load NASA POWER long-term climatology for mean temperature, wind speed and
surface solar radiation at each location. Choose a location from the map's
“Open a site” menu or click its globe marker to view the profile and climate
readings. The sidebar's no-API sunlight calculator estimates maximum winter
solstice Sun elevation at local noon from latitude. Low-light winter analog
sites (10° or less) are highlighted on the globe; this is illumination context,
not a rover failure probability. The calculator also visualizes the shadow of a
1 m rover using `shadow length = 1 m / tan(sun elevation)`. At or below the
horizon it reports night instead of inventing a shadow length.

The model's checkpoint files are not included here: the Hugging Face repository
is approximately 12.8 GB. The Lunar AI Lab source and its official hosted-demo
embed remain in the project but are hidden from the website for now. See the
[model card](https://huggingface.co/nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model)
and [live demo](https://huggingface.co/spaces/nasa-ibm-ai4science/nasa-ibm-lunar-foundation-model-generation-demo)
for model details and usage. Generated outputs are qualitative research probes,
not calibrated science or mission-planning data.

The planetary analog map uses NASA's interactive 3D Earth model, with the
existing location markers, filters and site profiles overlaid on the globe.
The model is stored in `assets/earth.glb` so it can load from local development
servers such as VS Code Live Server, which cannot fetch NASA's CORS-restricted
model endpoint. NASA POWER climatology is requested from its public API when a
site profile is opened; those readings supplement the illustrative profile
and do not currently affect match scores. The API's grid-cell averages may
differ from local conditions, particularly in high-relief terrain.