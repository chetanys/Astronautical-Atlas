# Hackathon1

Otherworld Atlas includes a **Lunar AI Lab** view with the NASA-IBM Lunar
Foundation Model's live hosted demo. Use the view tabs to switch between the
planetary analog map and the interactive cross-modal generation demo.

The model's checkpoint files are not included here: the Hugging Face repository
is approximately 12.8 GB. The AI Lab embeds the official Hugging Face Space
instead. See the [model card](https://huggingface.co/nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model)
and [live demo](https://huggingface.co/spaces/nasa-ibm-ai4science/nasa-ibm-lunar-foundation-model-generation-demo)
for model details and usage. Generated outputs are qualitative research
probes, not calibrated science or mission-planning data.

The planetary analog map uses NASA's interactive 3D Earth model, with the
existing location markers, filters and site profiles overlaid on the globe.
The model is stored in `assets/earth.glb` so it can load from local development
servers such as VS Code Live Server, which cannot fetch NASA's CORS-restricted
model endpoint.