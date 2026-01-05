import React, { useEffect, useRef, useState } from 'react';
import type { ClimateData, DisasterEvent, EnvironmentalData } from '../types';

import 'cesium/Build/Cesium/Widgets/widgets.css';

// Lazy load Cesium to avoid increasing initial bundle size
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CesiumMap: React.FC<{
  dataType: 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  focusCoord?: { lat: number; lng: number; label?: string };
  tilesetUrl?: string; // optional 3D Tiles source
}> = ({ dataType, climateData, disasters, environmentalData, focusCoord, tilesetUrl }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);

  // Convert lat/lng to Cesium Cartographic
  const makeEntities = () => {
    const chosen = dataType === 'temperature' ? climateData : dataType === 'disasters' ? disasters : environmentalData;
    return chosen.filter((d: any) => d.lat != null && d.lng != null).slice(0, 200); // limit for perf
  };

  const [pointWeather, setPointWeather] = useState<any | null>(null);
  const [pointAQI, setPointAQI] = useState<{ value: number; parameter: string; unit: string; category: string } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [countryDetails, setCountryDetails] = useState<any | null>(null);

  const aqiBadgeClass = (category: string) => {
    const base = 'text-xs px-2 py-0.5 rounded-full';
    const map: Record<string, string> = {
      'Good': 'bg-green-400 text-gray-900',
      'Moderate': 'bg-amber-400 text-gray-900',
      'Unhealthy for Sensitive': 'bg-orange-500 text-white',
      'Unhealthy': 'bg-red-500 text-white',
      'Very Unhealthy': 'bg-fuchsia-600 text-white',
      'Hazardous': 'bg-purple-700 text-white',
      '—': 'bg-gray-500 text-white',
    };
    return `${base} ${map[category] || 'bg-gray-500 text-white'}`;
  };

  const fetchNearestAQI = async (lat: number, lng: number) => {
    try {
      const base = 'https://api.openaq.org/v2/latest';
      const params = new URLSearchParams({
        coordinates: `${lat},${lng}`,
        radius: '100000',
        limit: '1',
        order_by: 'distance',
        sort: 'asc'
      });
      const r = await fetch(`${base}?${params.toString()}`);
      if (!r.ok) return null;
      const j = await r.json();
      const res = (j.results && j.results[0]) || null;
      const meas = res ? (res.measurements || []) : [];
      const pref = ['pm25','pm10','no2'];
      const m = meas.find((mm:any) => pref.includes(mm.parameter)) || meas[0] || null;
      if (!m) return null;
      const val = Number(m.value);
      const param = String(m.parameter).toUpperCase();
      const unit = String(m.unit || '');
      const category = (() => {
        const v = val;
        if (param === 'PM25' || param === 'PM2.5') {
          if (v <= 12) return 'Good';
          if (v <= 35.4) return 'Moderate';
          if (v <= 55.4) return 'Unhealthy for Sensitive';
          if (v <= 150.4) return 'Unhealthy';
          if (v <= 250.4) return 'Very Unhealthy';
          return 'Hazardous';
        }
        if (param === 'PM10') {
          if (v <= 54) return 'Good';
          if (v <= 154) return 'Moderate';
          if (v <= 254) return 'Unhealthy for Sensitive';
          if (v <= 354) return 'Unhealthy';
          if (v <= 424) return 'Very Unhealthy';
          return 'Hazardous';
        }
        return '—';
      })();
      return { value: Math.round(val), parameter: param, unit, category };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Cesium = await import('cesium');
      if (cancelled) return;
      // Ion token from env (user must set VITE_CESIUM_ION_TOKEN)
      const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
      if (ionToken) Cesium.Ion.defaultAccessToken = ionToken as string;

      // Create viewer with terrain provider
      const terrainProvider = await Cesium.createWorldTerrainAsync();
      viewerRef.current = new Cesium.Viewer(containerRef.current!, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: false,
        baseLayerPicker: true,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrainProvider,
      });

      const viewer = viewerRef.current;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;

      // --- HIGH RESOLUTION / 10K RENDERING ---
      try {
        // Target ~10K render buffer width while preserving current aspect ratio
        const targetWidth = 10000;
        const aspect = Math.max(0.1, (window.innerHeight || 1) / (window.innerWidth || 1));
        const targetHeight = Math.max(1, Math.round(targetWidth * aspect));
        const canvas: HTMLCanvasElement = viewer.canvas as HTMLCanvasElement;
        // Set logical drawing buffer size for ultra-high-res rendering
        // NOTE: extremely large buffers may exceed GPU limits; wrap in try/catch
        try {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        } catch (e) {
          // fallback to a safe high-res size if direct assignment fails
          try { canvas.width = 3840; canvas.height = 2160; } catch {}
        }
        // Keep CSS dimensions fluid so it still fits the layout
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        // Update camera aspect ratio if possible
        try {
          if (viewer.camera && viewer.camera.frustum && typeof (viewer.camera.frustum as any).aspectRatio !== 'undefined') {
            (viewer.camera.frustum as any).aspectRatio = (canvas.width / Math.max(1, canvas.height));
          }
        } catch {}

        // If Cesium exposes resolutionScale (newer versions), increase it as a best-effort
        try {
          if (typeof (viewer as any).resolutionScale !== 'undefined') {
            const scale = Math.max(1, Math.round((canvas.width / Math.max(1, window.innerWidth))));
            (viewer as any).resolutionScale = scale;
          }
        } catch {}
      } catch (e) {
        // ignore if any platform-specific failure
      }


      // Add entities for selected dataset and map many available fields to visuals
      const entities = makeEntities();
      const extrudedEntities: any[] = [];
      // enable client-side clustering for large datasets
      try {
        viewer.entities.cluster.enabled = true;
        viewer.entities.cluster.pixelRange = 60;
        viewer.entities.cluster.minimumClusterSize = 4;
        viewer.entities.cluster.clusterLabel = new Cesium.LabelGraphics({
          text: '{count}',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        });
      } catch {}

      const getVisuals = (d: any) => {
        // color: prefer explicit color, then kind/status mapping, then value-driven
        let hex = d.color || (d.kind === 'wildfire' ? '#ff7043' : d.kind === 'storm' ? '#60a5fa' : d.kind === 'flood' ? '#38bdf8' : undefined);
        if (!hex) {
          if (dataType === 'disasters') {
            const sev = (d.severity || '').toString().toLowerCase();
            hex = sev === 'high' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#fbbf24';
          } else if (dataType === 'environmental') {
            hex = '#10b981';
          } else if (typeof d.temperature === 'number') {
            hex = d.temperature > 28 ? '#ef4444' : '#3b82f6';
          } else hex = '#3b82f6';
        }

        const color = Cesium.Color.fromCssColorString(hex).withAlpha(0.9);
        // size: use magnitude / impact / count fields
        const magnitude = d.magnitude || d.impact || d.value || d.intensity || 1;
        const pixelSize = Math.min(48, Math.max(6, (typeof magnitude === 'number' ? Math.round(Math.sqrt(Math.abs(magnitude)) * 4) : 10)));
        // extrude height for disasters/environmental severity
        const sev = (d.severity || d.category || '').toString().toLowerCase();
        const baseHeight = sev === 'high' ? 300000 : sev === 'medium' ? 140000 : sev === 'low' ? 50000 : (magnitude && typeof magnitude === 'number' ? Math.abs(magnitude) * 20000 : 60000);
        // label text: include many fields
        const labelLines: string[] = [];
        if (d.location) labelLines.push(String(d.location));
        if (d.type) labelLines.push(String(d.type));
        if (typeof d.temperature === 'number') labelLines.push(`${d.temperature}°C`);
        if (d.aqi) labelLines.push(`AQI:${d.aqi}`);
        if (d.magnitude) labelLines.push(`Mag:${d.magnitude}`);
        if (d.severity) labelLines.push(`Severity:${d.severity}`);
        if (d.status) labelLines.push(`${d.status}`);
        const labelText = labelLines.join('\n') || (d.label || d.id || 'Point');

        // optional icon for recognized kinds/status
        let icon: string | undefined;
        if (d.kind === 'wildfire' || /fire/i.test(d.type || '')) icon = '🔥';
        else if (d.kind === 'storm' || /storm|hurricane|cyclone/i.test(d.type || '')) icon = '🌪️';
        else if (d.kind === 'flood' || /flood/i.test(d.type || '')) icon = '🌊';
        else if (d.status === 'offline') icon = '⛔';
        else if (d.status === 'degraded') icon = '⚠️';

        return { color, pixelSize, baseHeight, labelText, icon };
      };

      entities.forEach((d: any) => {
        try {
          const vis = getVisuals(d);
          const pos = Cesium.Cartesian3.fromDegrees(d.lng, d.lat);
          const ent: any = viewer.entities.add({
            position: pos,
            point: { pixelSize: vis.pixelSize, color: vis.color, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
            label: {
              text: vis.labelText,
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -Math.max(12, vis.pixelSize)),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: d,
            name: d.location || d.label || d.id || d.type || 'Point'
          });

          // billboard icon rendered as label replacement when available
          if (vis.icon) {
            // use a simple text-based billboard via data URI SVG
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='40'>${vis.icon}</text></svg>`;
            ent.billboard = { image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, scale: Math.min(2.5, Math.max(0.6, vis.pixelSize / 16)) };
            // hide point when billboard shown
            ent.point = { show: false };
          }

          // create extruded geometry for disasters/environmental features
          if (dataType === 'disasters' || dataType === 'environmental') {
            const ellipse = viewer.entities.add({
              position: pos,
              ellipse: {
                semiMajorAxis: Math.max(8000, vis.pixelSize * 2000),
                semiMinorAxis: Math.max(8000, vis.pixelSize * 1600),
                material: new Cesium.ColorMaterialProperty(vis.color.withAlpha(0.45)),
                extrudedHeight: vis.baseHeight,
                height: 0,
              }
            });
            extrudedEntities.push({ entity: ellipse, baseHeight: vis.baseHeight });
          }

          // if the record contains a track/route, draw it as a polyline
          if (Array.isArray(d.track) && d.track.length > 1) {
            try {
              const pts = d.track.map((p: any) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat));
              viewer.entities.add({
                polyline: {
                  positions: pts,
                  width: 3,
                  material: new Cesium.PolylineOutlineMaterialProperty({
                    color: vis.color,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1
                  })
                }
              });
            } catch {}
          }

        } catch (e) {
          // ignore per-entity failures
        }
      });

      // Load country polygons as GeoJSON datasource for click/select
      try {
        const geoUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
        const countriesDs = await Cesium.GeoJsonDataSource.load(geoUrl, {
          stroke: Cesium.Color.fromCssColorString('rgba(200,200,200,0.15)'),
          fill: Cesium.Color.fromCssColorString('rgba(0,0,0,0)'),
          strokeWidth: 1
        });
        viewer.dataSources.add(countriesDs);
        // style labels (optional)
        countriesDs.entities.values.forEach((e: any) => {
          if (e && e.properties && (e.properties.name || e.properties.ADMIN)) {
            const name = e.properties.name || e.properties.ADMIN || '';
            e.name = name;
          }
        });
      } catch (e) {
        // ignore geojson failures
      }

      // 3D features: enable shadows, terrain exaggeration and post-processing where available
      try {
        viewer.shadows = true;
        if (viewer.scene && viewer.scene.shadowMap) {
          viewer.scene.shadowMap.enabled = true;
          (viewer.scene.shadowMap as any).softShadows = true;
        }
        // terrain exaggeration (Cesium 1.93+ may support globe.terrainExaggeration)
        try { if (viewer.scene && typeof (viewer.scene.globe as any).terrainExaggeration !== 'undefined') (viewer.scene.globe as any).terrainExaggeration = 1.6; } catch {}
      } catch {}

      // click handler: pick entities or globe position
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      const readProps = (props: any) => {
        const out: Record<string, any> = {};
        if (!props) return out;
        try {
          Object.keys(props).forEach((k) => {
            try { out[k] = props[k] && props[k].getValue ? props[k].getValue(Cesium.JulianDate.now()) : props[k]; } catch { out[k] = props[k]; }
          });
        } catch {}
        return out;
      };
      handler.setInputAction(async (click: any) => {
        try {
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id) {
            // if entity has position (point), use that; if polygon, fly to it and fetch details
            const id = picked.id;
            if (id.position) {
              const cart = id.position.getValue(Cesium.JulianDate.now());
              const carto = Cesium.Cartographic.fromCartesian(cart);
              const lat = Cesium.Math.toDegrees(carto.latitude);
              const lng = Cesium.Math.toDegrees(carto.longitude);
              // expose selected entity properties for overlay UI
              try { setSelectedEntity({ name: id.name, properties: readProps(id.properties) }); } catch { setSelectedEntity(null); }
              // fetch AQI only (remove Open‑Meteo fetches to avoid external API usage)
              try {
                const aqi = await fetchNearestAQI(lat, lng);
                setPointAQI(aqi);
                setPointWeather(null);
              } catch { setPointAQI(null); setPointWeather(null); }
            } else if (id.polygon || id.name) {
              // clear selected point entity when selecting a polygon (country)
              setSelectedEntity(null);
              // fly to entity
              try {
                // noop: placeholder for potential bounding computations
              } catch {}
              try {
                const b = Cesium.BoundingSphere.fromPoints((id.polygon && id.polygon.hierarchy && id.polygon.hierarchy.positions) ? id.polygon.hierarchy.positions.getValue(Cesium.JulianDate.now()) : []);
                if (b) viewer.camera.flyToBoundingSphere(b, { duration: 1.0 });
              } catch {
                // fallback: fly to first coordinate of polygon
                const poly = id.polygon && id.polygon.hierarchy && id.polygon.hierarchy.getValue ? id.polygon.hierarchy.getValue(Cesium.JulianDate.now()) : null;
                if (poly && poly.positions && poly.positions.length) {
                  const cart = poly.positions[0];
                  const carto = Cesium.Cartographic.fromCartesian(cart);
                  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), 2000000), duration: 1.2 });
                }
              }

              // set selected country properties and fetch details
              const props = id.properties || {};
              const name = (props.name && props.name.getValue) ? props.name.getValue(Cesium.JulianDate.now()) : (props.ADMIN && props.ADMIN.getValue ? props.ADMIN.getValue(Cesium.JulianDate.now()) : null);
              setSelectedCountry({ name, props });
              // fetch restcountries by name
              if (name) {
                try {
                  const r = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=false`);
                  if (r.ok) {
                    const jd = await r.json();
                    setCountryDetails(Array.isArray(jd) ? jd[0] : jd);
                  }
                } catch {}
              }
            }
          } else {
            // click on globe surface -> position
            const cart = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            if (!cart) return;
            const carto = Cesium.Cartographic.fromCartesian(cart);
            const lat = Cesium.Math.toDegrees(carto.latitude);
            const lng = Cesium.Math.toDegrees(carto.longitude);
            try {
              const aqi = await fetchNearestAQI(lat, lng);
              setPointAQI(aqi);
              setPointWeather(null);
            } catch { setPointAQI(null); setPointWeather(null); }
          }
        } catch (e) {
          // ignore
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // cleanup handler on destroy
      (viewer as any)._cesiumClickHandler = handler;

      // Animated extrusion loop for disaster entities
      const animEntities = extrudedEntities;
      let animFrame: number | null = null;
      const animate = () => {
        try {
          const t = (Date.now() % 5000) / 5000; // 0..1
          const scale = 0.6 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
          animEntities.forEach((it) => {
            try { if (it && it.entity && it.entity.ellipse) it.entity.ellipse.extrudedHeight = it.baseHeight * scale; } catch {}
          });
        } catch {}
        animFrame = requestAnimationFrame(animate);
      };
      animFrame = requestAnimationFrame(animate);
      (viewer as any)._cesiumExtrudeAnimation = animFrame;

      // Optional 3D Tiles
      if (tilesetUrl) {
        try {
          const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);
          viewer.scene.primitives.add(tileset);
        } catch (e) {
          // ignore load errors
        }
      }

      // Fly to focus coordinate
      if (focusCoord) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(focusCoord.lng, focusCoord.lat, 2000000),
          duration: 2.0
        });
      } else if (entities.length) {
        viewer.zoomTo(viewer.entities);
      }
    })();
    return () => {
      cancelled = true;
      try {
        if (viewerRef.current) {
          // remove click handler
          try { const h = (viewerRef.current as any)._cesiumClickHandler; if (h) h.destroy(); } catch {}
          // cancel animation
          try { const af = (viewerRef.current as any)._cesiumExtrudeAnimation; if (af) cancelAnimationFrame(af); } catch {}
          viewerRef.current && viewerRef.current.destroy();
        }
      } catch {}
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to focus changes after init
  useEffect(() => {
    if (!viewerRef.current || !focusCoord) return;
    (async () => {
      const Cesium = await import('cesium');
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(focusCoord.lng, focusCoord.lat, 1500000),
        duration: 1.5
      });
    })();
  }, [focusCoord?.lat, focusCoord?.lng]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Overlay: selected info */}
      <div className="absolute right-4 top-4 z-50 w-80 space-y-2 pointer-events-auto">
        {selectedCountry && (
          <div className="bg-black bg-opacity-60 text-white p-3 rounded-md shadow-md">
            <div className="font-semibold">Country: {selectedCountry.name}</div>
            {countryDetails && (
              <div className="text-xs mt-2">
                <div>Capital: {countryDetails.capital ? countryDetails.capital[0] : '—'}</div>
                <div>Population: {countryDetails.population ? countryDetails.population.toLocaleString() : '—'}</div>
                <div className="text-gray-300">Region: {countryDetails.region || '—'}</div>
              </div>
            )}
          </div>
        )}

        {selectedEntity && (
          <div className="bg-black bg-opacity-60 text-white p-3 rounded-md shadow-md">
            <div className="font-semibold">{selectedEntity.name || 'Entity'}</div>
            <div className="text-xs mt-2 max-h-36 overflow-auto">
              {Object.entries(selectedEntity.properties || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px] py-0.5">
                  <span className="text-gray-200">{k}</span>
                  <span className="font-mono text-gray-100">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pointWeather && (
          <div className="bg-black bg-opacity-60 text-white p-3 rounded-md shadow-md">
            <div className="font-semibold">Weather @ {pointWeather.coord?.label || ''}</div>
            <div className="text-xs mt-2">
              <div>Summary: {pointWeather.data?.current_weather ? `${pointWeather.data.current_weather.temperature}°C • ${pointWeather.data.current_weather.weathercode || ''}` : '—'}</div>
              <div className="text-xs text-gray-300">Storm forecast: {pointWeather.storm ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        {pointAQI && (
          <div className="bg-black bg-opacity-60 text-white p-2 rounded-md shadow-md flex items-center justify-between">
            <div className="text-xs">AQI: <span className="font-semibold">{pointAQI.value}</span></div>
            <div className={aqiBadgeClass(pointAQI.category)}>{pointAQI.category}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CesiumMap;