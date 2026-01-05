<div align="center">

<h1>🌍 GEOSTORM</h1>  
  
</div>


<div align="center">

[![Google Maps Platform Award](https://img.shields.io/badge/🏆_Fan_Favorite_Winner-Google_Maps_Platform_Awards_2025-4285F4?style=for-the-badge&logo=googlemaps)](https://mapsplatform.google.com/awards/nominees/global-climate-tracker/)
[![Sustainability](https://img.shields.io/badge/Category-Sustainability-green?style=for-the-badge)](https://mapsplatform.google.com/awards/nominees/global-climate-tracker/)

[![Contributors](https://img.shields.io/github/contributors/NEXBIT-X/GEOSTORM?style=flat-square)](https://github.com/NEXBIT-X/GEOSTORM/graphs/contributors)
[![Stars](https://img.shields.io/github/stars/NEXBIT-X/GEOSTORM?style=flat-square)](https://github.com/NEXBIT-X/GEOSTORM)
[![Forks](https://img.shields.io/github/forks/NEXBIT-X/GEOSTORM?style=flat-square)](https://github.com/NEXBIT-X/GEOSTORM)
</div>

---

## 🎉 **Award Recognition**

<div align="center">

### 🏆 **FAN FAVORITE WINNER** 🏆
#### Google Maps Platform Awards 2025
*Sustainability Category*

*Recognized for bridging the climate data gap with innovative visualization and making climate science accessible to everyone.*

</div>

---

## 🌟 **About GEOSTORM**

Climate change is one of the most pressing challenges of our time, yet the vast amount of available climate data remains fragmented and difficult for the public to access and understand. **GEOSTORM** was created to bridge this critical gap.

**GEOSTORM** is a cutting-edge, data-driven web platform that collects and displays real-time global climate indicators through interactive visualizations. Our mission is to provide accessible, evidence-based insights into critical climate change metrics, enhancing public awareness and informing policy decisions worldwide.

### 🎯 **Mission Statement**
*Democratizing climate data to accelerate global climate action through accessible visualization and real-time insights.*

---


<div align="center">

### 🌍 **Together, We Can Combat Climate Change** 🌱

*GEOSTORM is more than a platform—it's a movement toward data-driven climate action.*

---

**Made with ❤️ by Team NEXBIT**  
*Empowering climate action through data visualization*

</div>

---

## 🛡️ Resilience Overlay (Realtime)

The optional **Infrastructure + Hazard Resilience Overlay** augments the globe with publicly relevant points useful for preparedness research:

- Critical infrastructure (live sample from OpenStreetMap / Overpass: hospitals, power plants, ports, shelters) color‑coded by operational status (OSM has no live status; defaults applied).
- Recent environmental hazard events from multiple sources:
  - **NASA EONET** - Natural events (wildfires, floods, storms)
  - **USGS Earthquakes** - Real-time seismic activity
  - **FEMA OpenFEMA API** - Official U.S. disaster declarations (hurricanes, floods, wildfires, etc.)
- Points are sized and colored by intensity/severity.

### FEMA API Integration

GEOSTORM now integrates with the **FEMA OpenFEMA API** to display official disaster declarations from the Federal Emergency Management Agency. This provides authoritative disaster data for the United States including:

- **Disaster Types**: Hurricanes, floods, severe storms, wildfires, earthquakes, tornadoes, etc.
- **Coverage**: Last 90-180 days of disaster declarations
- **Data Points**: Disaster name, incident type, state, declaration date, severity
- **Geographic Display**: State-level positioning with intelligent offset to prevent overlaps

API Endpoint: `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries`

No API key required - fully open data source.

### How to Use
1. Use bottom-right panel "Resilience Overlay".
2. Click Enable to start realtime feed (auto refresh ~30s).
3. Points appear on globe; a small status text shows loading/errors.
4. FEMA disasters are automatically fetched and displayed alongside NASA EONET and USGS data.

### Purpose
This layer supports non-sensitive resilience and sustainability research by visually correlating environmental hazards with nearby public infrastructure. Data sources:
* **FEMA OpenFEMA** (official U.S. disaster declarations)
* NASA EONET (open events; wildfire, floods, storms)
* USGS Earthquake GeoJSON feed (hourly summary)
* OpenStreetMap via Overpass (limited regional slice to reduce load)

### Integration Points
- Toggle & legend: `ResilienceOverlayPanel` (bottom-right).
- Live fetch & fallback: `src/services/hazards.ts` (`fetchLiveOverlay`).
- FEMA integration: `src/services/fema.ts` (disaster fetching & mapping).
- Main data aggregation: `src/services/liveData.ts` (`fetchLiveData`).
- Rendering & status: `GlobeMap` (merges points, shows loading/error text).

---

## 🛰️ Cesium Integration (Optional Globe Engine)

GEOSTORM now supports an alternative 3D globe powered by **CesiumJS** for richer terrain, lighting, and advanced geospatial features.

### Setup
1. Dependencies are already added (`cesium`, `vite-plugin-static-copy`).
2. Provide an Ion access token (recommended for high‑quality assets):
	```bash
	echo VITE_CESIUM_ION_TOKEN=YOUR_ION_TOKEN >> .env
	```
3. Vite copies required static assets to `/cesium` and defines `CESIUM_BASE_URL`.
4. Switch rendering by passing `useCesium={true}` (and optional `tilesetUrl`) to `MapContainer`.

### Implemented Features
- World terrain via `createWorldTerrain()`.
- Atmospheric lighting + ground atmosphere.
- Entity overlays for temperature, disaster, and environmental datasets (color coded like existing globe).
- Camera fly to focused coordinates (search & selection).
- Optional 3D Tileset loading through `tilesetUrl` prop.

### Extend Further
- Add imagery layers (Sentinel-2, Bing) with `viewer.imageryLayers.addImageryProvider(...)`.
- Use `CustomDataSource` + `EntityCluster` for scalable point clustering.
- Time-dynamic paths (storms, infrastructure outages) via `SampledPositionProperty`.
- Post-processing (bloom, FXAA) via `viewer.scene.postProcessStages`.
- Heatmaps / density visualization using custom `Primitive` + `Appearance` shaders.

### Notes
- Without an Ion token, default terrain loads but premium imagery may be limited.
- Keep point counts modest (<5k) unless clustering is enabled to preserve frame rate.

Source file: `src/components/CesiumMap.tsx`.

---
