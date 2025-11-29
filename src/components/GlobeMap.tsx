import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import Card from './ui/Card';
import { fetchWeatherForPoint, isStormForecast } from '../services/openMeteo';

// Map Open-Meteo weather codes to emoji/icon + description
const weatherCodeToIcon = (code: number | null | undefined) => {
  const map: Record<number, [string, string]> = {
    0: ['☀️', 'Clear'],
    1: ['🌤️', 'Mainly clear'],
    2: ['⛅', 'Partly cloudy'],
    3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'],
    48: ['🌫️', 'Depositing rime fog'],
    51: ['🌦️', 'Light drizzle'],
    53: ['🌦️', 'Moderate drizzle'],
    55: ['🌧️', 'Dense drizzle'],
    56: ['🌧️', 'Freezing drizzle'],
    57: ['🌧️', 'Freezing drizzle heavy'],
    61: ['🌧️', 'Light rain'],
    63: ['🌧️', 'Moderate rain'],
    65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'],
    67: ['🌧️', 'Freezing rain heavy'],
    71: ['❄️', 'Light snow'],
    73: ['❄️', 'Moderate snow'],
    75: ['❄️', 'Heavy snow'],
    77: ['❄️', 'Snow grains'],
    80: ['🌧️', 'Rain showers slight'],
    81: ['🌧️', 'Rain showers moderate'],
    82: ['⛈️', 'Rain showers violent'],
    85: ['❄️', 'Snow showers slight'],
    86: ['❄️', 'Snow showers heavy'],
    95: ['⛈️', 'Thunderstorm'],
    96: ['⛈️', 'Thunderstorm with slight hail'],
    99: ['⛈️', 'Thunderstorm with heavy hail'],
  };
  if (code == null) return ['❓', 'Unknown'];
  return map[code] || ['❓', 'Unknown'];
};

interface GlobeMapProps {
  dataType: 'temperature' | 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  apiAction?: 'openmeteo_current' | 'openmeteo_hourly' | 'openmeteo_daily';
  onApiConsumed?: () => void;
  focusCoord?: { lat: number; lng: number; label?: string } | undefined;
}

const GlobeMap: React.FC<GlobeMapProps> = ({ dataType, climateData, disasters, environmentalData, apiAction, onApiConsumed, focusCoord }) => {
  const globeEl = useRef<any>(null);

  const data = useMemo(() => {
    switch (dataType) {
      case 'temperature': return climateData;
      case 'disasters': return disasters;
      case 'environmental': return environmentalData;
      default: return [];
    }
  }, [dataType, climateData, disasters, environmentalData]);

  // Convert to globe points
  const points = useMemo(() => data
    .filter((d: any) => d.lat !== undefined && d.lng !== undefined)
    .map((d: any) => ({
      lat: d.lat,
      lng: d.lng,
      size: Math.min(5, Math.max(1, (d.temperature ?? d.airQuality ?? 1) / 20)),
      color: dataType === 'disasters' ? (d.severity === 'High' ? '#dc2626' : d.severity === 'Medium' ? '#f59e0b' : '#fbbf24') : dataType === 'environmental' ? '#10b981' : (d.temperature && d.temperature > 25 ? '#ef4444' : '#3b82f6'),
      label: d.location || d.type || 'Point',
      original: d,
    })), [data, dataType]
  );

  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
  const [countryDetails, setCountryDetails] = useState<any | null>(null);
  const [countryWeather, setCountryWeather] = useState<any | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // progressive globe image: low-res then swap to high-res
  const lowResGlobe = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';
  const highResGlobe = '/8081_earthmap10k.jpg';
  const [globeImage, setGlobeImage] = useState<string>(highResGlobe);
  const localBump = '/textures/earth-bump.jpg';
  const fallbackBump = 'https://threejs.org/examples/textures/earthbump1k.jpg';
  const [bumpImage, setBumpImage] = useState<string>(fallbackBump);
  const [polarInfo, setPolarInfo] = useState<{ lat: number; lng: number; current?: any | null; daily?: any | null; loading?: boolean } | null>(null);

  // simple in-memory cache for weather by key (iso or name)
  const weatherCacheRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // fetch world geojson (public raw GitHub): lightweight world.geojson
    const url = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
    fetch(url).then(res => res.json()).then((geojson) => {
      if (geojson && geojson.features) setCountries(geojson.features);
    }).catch(() => {
      // ignore fetch errors
    });
  }, []);

  useEffect(() => {
    // Zoom/preset options
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 1.6 }, 800);
    }
  }, [points.length]);

  // Improve renderer and texture quality for HD visuals
  const configureQuality = () => {
    try {
      if (!globeEl.current) return;
      const renderer = globeEl.current.renderer && globeEl.current.renderer();
      if (renderer && typeof renderer.setPixelRatio === 'function') {
        renderer.setPixelRatio(window.devicePixelRatio || 1);
      }

      const mat = globeEl.current.globeMaterial && globeEl.current.globeMaterial();
      if (mat && mat.map) {
        const maxAniso = (renderer && renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function') ? renderer.capabilities.getMaxAnisotropy() : 1;
        try { mat.map.anisotropy = maxAniso; } catch (e) { /* ignore */ }
        try { mat.map.minFilter = THREE.LinearFilter; mat.map.magFilter = THREE.LinearFilter; } catch (e) { /* ignore */ }
        mat.map.needsUpdate = true;
        // aggressively reduce rim/halo by clearing reflective/emissive properties
        try {
          if (mat.emissive && typeof mat.emissive.set === 'function') mat.emissive.set(0x000000);
          if (typeof (mat as any).emissiveIntensity !== 'undefined') (mat as any).emissiveIntensity = 0;
          if (mat.specular && typeof mat.specular.set === 'function') mat.specular.set(0x000000);
          if (typeof (mat as any).shininess !== 'undefined') (mat as any).shininess = 0;
          if (typeof (mat as any).bumpScale !== 'undefined') (mat as any).bumpScale = 0.0;
          if (typeof (mat as any).envMap !== 'undefined') (mat as any).envMap = null;
          if (typeof (mat as any).envMapIntensity !== 'undefined') (mat as any).envMapIntensity = 0;
          if (typeof (mat as any).metalness !== 'undefined') (mat as any).metalness = 0;
          if (typeof (mat as any).roughness !== 'undefined') (mat as any).roughness = 1;
          if (typeof (mat as any).reflectivity !== 'undefined') (mat as any).reflectivity = 0;
          if (typeof (mat as any).specularMap !== 'undefined') (mat as any).specularMap = null;
          if (typeof (mat as any).emissiveMap !== 'undefined') (mat as any).emissiveMap = null;
          mat.needsUpdate = true;
        } catch (e) { /* ignore */ }
      }

      // clouds/bump texture
      if (mat && mat.bumpMap) {
        try { mat.bumpMap.anisotropy = (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 1; } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    configureQuality();
    window.addEventListener('resize', configureQuality);
    return () => window.removeEventListener('resize', configureQuality);
  }, []);

  // Validate texture availability; fallback to low-res if missing
  useEffect(() => {
    let mounted = true;
    const img = new Image();
    img.src = highResGlobe;
    img.onload = () => {
      if (!mounted) return;
      setGlobeImage(highResGlobe);
      setTimeout(() => configureQuality(), 50);
    };
    img.onerror = () => {
      if (!mounted) return;
      setGlobeImage(lowResGlobe);
    };
    return () => { mounted = false; };
  }, [highResGlobe]);

  // Preload local bump map; fallback to remote if missing
  useEffect(() => {
    let mounted = true;
    const img = new Image();
    img.src = localBump;
    img.onload = () => { if (mounted) setBumpImage(localBump); };
    img.onerror = () => { if (mounted) setBumpImage(fallbackBump); };
    return () => { mounted = false; };
  }, []);

  // When a country is selected, fetch details from REST Countries
  useEffect(() => {
    let mounted = true;
    setCountryDetails(null);
    if (!selectedCountry) return;
    const tryFetch = async () => {
      const props = selectedCountry.properties || {};
      const name = props.name || props.ADMIN || props.NAME || null;
      const isoA3 = props.iso_a3 || props.ISO_A3 || props.ADM0_A3 || null;

      const fetchByCode = async (code: string) => {
        try {
          const r = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`);
          if (!r.ok) return null;
          const d = await r.json();
          return Array.isArray(d) ? d[0] : d;
        } catch (e) {
          return null;
        }
      };

      const fetchByName = async (n: string, full = true) => {
        try {
          const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(n)}${full ? '?fullText=true' : ''}`;
          const r = await fetch(url);
          if (!r.ok) return null;
          const d = await r.json();
          return Array.isArray(d) ? d[0] : d;
        } catch (e) {
          return null;
        }
      };

      let details: any = null;
      if (isoA3) details = await fetchByCode(isoA3);
      if (!details && name) details = await fetchByName(name, true);
      if (!details && name) details = await fetchByName(name, false);

      if (mounted) setCountryDetails(details);
    };

    tryFetch();
    return () => { mounted = false; };
  }, [selectedCountry]);

  // Fetch current weather for the selected country's capital/centroid using Open-Meteo
  useEffect(() => {
    let mounted = true;
    setCountryWeather(null);
    setWeatherLoading(false);
    if (!countryDetails) return;

    (async () => {
      const key = countryDetails.cca3 || countryDetails.ccn3 || (countryDetails.name && (countryDetails.name.common || countryDetails.name.official)) || (selectedCountry && selectedCountry.properties && (selectedCountry.properties.iso_a3 || selectedCountry.properties.ISO_A3 || selectedCountry.properties.ADM0_A3)) || 'unknown';
      if (weatherCacheRef.current.has(key)) {
        if (!mounted) return;
        setCountryWeather(weatherCacheRef.current.get(key));
        return;
      }

      // determine coordinates: prefer capitalInfo.latlng, then country latlng
      let coords: number[] | null = null;
      if (countryDetails.capitalInfo && Array.isArray(countryDetails.capitalInfo.latlng) && countryDetails.capitalInfo.latlng.length === 2) {
        coords = countryDetails.capitalInfo.latlng;
      } else if (Array.isArray(countryDetails.latlng) && countryDetails.latlng.length === 2) {
        coords = countryDetails.latlng;
      } else if (selectedCountry && selectedCountry.properties && selectedCountry.properties && selectedCountry.properties.center) {
        const c = selectedCountry.properties.center;
        if (Array.isArray(c) && c.length === 2) coords = c;
      }

      if (!coords) return;

      setWeatherLoading(true);
      try {
        const [lat, lon] = coords as number[];
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=3`);
        if (!r.ok) {
          if (mounted) setCountryWeather(null);
          return;
        }
        const j = await r.json();
        const current = j.current_weather || null;
        const daily = j.daily || null;
        const payload = { current, daily };
        weatherCacheRef.current.set(key, payload);
        if (mounted) setCountryWeather(payload);
      } catch (e) {
        if (mounted) setCountryWeather(null);
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [countryDetails, selectedCountry]);

  useEffect(() => {
    // enable smooth auto-rotation to mimic Earth's rotation
    try {
      if (!globeEl.current) return;
      const controls = globeEl.current.controls && globeEl.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.25; // tune for realistic slow rotation
      }
    } catch (e) {
      // ignore if controls aren't available yet
    }
  }, []);

  // Make globe fill the viewport completely
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [globeW, setGlobeW] = useState<number>(window.innerWidth);
  const [globeH, setGlobeH] = useState<number>(window.innerHeight);
  const [pointWeather, setPointWeather] = useState<any | null>(null);
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [overlayMode, setOverlayMode] = useState<'current' | 'hourly' | 'daily'>('current');
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [stormPath, setStormPath] = useState<Array<{ lat: number; lng: number; size: number; color: string }>>([]);

  // Space background and planets
  const spaceGroupRef = useRef<any>(null);
  const planetsRef = useRef<Array<{ mesh: any; orbitRadius: number; speed: number; angle: number; selfRot: number }>>([]);
  const animRef = useRef<number | null>(null);
  const clockRef = useRef<any>(null);

  useEffect(() => {
    const onResize = () => {
      setGlobeW(window.innerWidth);
      setGlobeH(window.innerHeight);
      try { configureQuality(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // External focus (from search)
  useEffect(() => {
    if (!focusCoord) return;
    try {
      if (globeEl.current) globeEl.current.pointOfView({ lat: focusCoord.lat, lng: focusCoord.lng, altitude: 1.4 }, 900);
      (async () => {
        try {
          const w = await fetchWeatherForPoint(focusCoord.lat, focusCoord.lng);
          setPointWeather({ coord: focusCoord, data: w, storm: isStormForecast(w) });
          setLastCoord({ lat: focusCoord.lat, lng: focusCoord.lng, label: focusCoord.label });
        } catch {}
      })();
    } catch {}
  }, [focusCoord?.lat, focusCoord?.lng]);

  // Build animated space background with nearby planets
  useEffect(() => {
    if (!globeEl.current) return;
    const scene: any = globeEl.current.scene && globeEl.current.scene();
    if (!scene) return;

    // Group to hold stars and planets
    const group = new THREE.Group();
    spaceGroupRef.current = group;

    // Starfield
    const STAR_COUNT = 4000;
    const positions = new Float32Array(STAR_COUNT * 3);
    const minR = 600, maxR = 900;
    for (let i = 0; i < STAR_COUNT; i++) {
      // random point on sphere shell between minR..maxR
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = minR + Math.random() * (maxR - minR);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.9 });
    const stars = new THREE.Points(starGeo, starMat);
    group.add(stars);

    // Lights for planets (subtle)
    const ambient = new THREE.AmbientLight(0x888888, 0.35);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight.position.set(5, 10, 7);
    group.add(ambient);
    group.add(dirLight);

    // Soft sun sprite (billboard) far away
    const sunTex = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/sprites/spark1.png');
    const sunMat = new THREE.SpriteMaterial({ map: sunTex, color: 0xffdd88, transparent: true, opacity: 0.8 });
    const sun = new THREE.Sprite(sunMat);
    sun.scale.set(60, 60, 1);
    sun.position.set(-300, 150, -600);
    group.add(sun);

    // Texture loader with graceful fallback
    const loader = new THREE.TextureLoader();
    const tryTexture = (path: string) => {
      try {
        const tex = loader.load(path);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
      } catch { return null; }
    };

    // Helper to create a planet with optional texture
    const createPlanet = (color: number, radius: number, orbitRadius: number, speed: number, initialAngle: number, texturePath?: string) => {
      const geo = new THREE.SphereGeometry(radius, 48, 48);
      const tex = texturePath ? tryTexture(texturePath) : null;
      const mat = tex
        ? new THREE.MeshPhongMaterial({ map: tex, shininess: 6 })
        : new THREE.MeshPhongMaterial({ color, shininess: 8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(orbitRadius * Math.cos(initialAngle), radius * 0.1, orbitRadius * Math.sin(initialAngle));
      group.add(mesh);
      planetsRef.current.push({ mesh, orbitRadius, speed, angle: initialAngle, selfRot: 0.2 + Math.random() * 0.2 });
    };

    // Nearby stylized planets (not to scale)
    createPlanet(0xaaaaaa, 0.27, 3.2, 0.04, Math.random() * Math.PI * 2, '/textures/moon.jpg');
    createPlanet(0xcc8844, 0.30, 4.2, 0.03, Math.random() * Math.PI * 2, '/textures/venus.jpg');
    createPlanet(0xb03030, 0.33, 5.5, 0.02, Math.random() * Math.PI * 2, '/textures/mars.jpg');

    // Nebula sprites for depth
    const makeNebula = (color: number, scale: number, pos: [number, number, number], rotY: number) => {
      const nTex = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/sprites/smokeparticle.png');
      const nMat = new THREE.SpriteMaterial({ map: nTex, color, transparent: true, opacity: 0.35 });
      const n = new THREE.Sprite(nMat);
      n.scale.set(scale, scale, 1);
      n.position.set(pos[0], pos[1], pos[2]);
      n.rotation.y = rotY;
      group.add(n);
    };
    const nebulae: any[] = [];
    const n1 = makeNebula(0x77aaff, 120, [500, -100, -700], 0.2);
    const n2 = makeNebula(0xff99cc, 140, [-650, 80, 800], -0.3);
    const n3 = makeNebula(0x99ffaa, 100, [300, 150, 600], 0.6);
    nebulae.push(n1, n2, n3);

    // Milky Way skysphere (inside-out sphere with texture)
    const skyGeo = new THREE.SphereGeometry(1200, 64, 64);
    skyGeo.scale(-1, 1, 1);
    const milkyTex = tryTexture('/textures/milkyway.jpg') || tryTexture('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/skybox/milkyway.jpg');
    const skyMat = new THREE.MeshBasicMaterial({ map: milkyTex ?? undefined, color: milkyTex ? 0xffffff : 0x101018 });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    group.add(skyMesh);

    scene.add(group);

    // Animation loop (piggybacks on three render loop)
    const clock = new THREE.Clock();
    clockRef.current = clock;
    const animate = () => {
      const dt = clock.getDelta();
      // slow rotation of starfield
      group.rotation.y += dt * 0.01;
      // orbit planets
      for (const p of planetsRef.current) {
        p.angle += dt * p.speed;
        const x = p.orbitRadius * Math.cos(p.angle);
        const z = p.orbitRadius * Math.sin(p.angle);
        p.mesh.position.set(x, p.mesh.position.y, z);
        p.mesh.rotation.y += dt * p.selfRot;
      }
      // subtle parallax: shift nebula slightly based on globe POV
      try {
        const pov = globeEl.current.pointOfView && globeEl.current.pointOfView();
        const lat = pov?.lat ?? 0;
        const lng = pov?.lng ?? 0;
        const parX = Math.sin((lng * Math.PI) / 180) * 8;
        const parY = Math.sin((lat * Math.PI) / 180) * 5;
        nebulae.forEach((n, i) => {
          if (!n) return;
          const k = 0.02 + i * 0.01;
          n.position.x += (parX - n.position.x) * k;
          n.position.y += (parY - n.position.y) * k;
        });
      } catch {}
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      // cleanup
      try {
        scene.remove(group);
        group.traverse((obj: any) => {
          // dispose geometries and materials
          const anyObj: any = obj as any;
          if (anyObj.geometry && typeof anyObj.geometry.dispose === 'function') anyObj.geometry.dispose();
          if (anyObj.material) {
            const m = anyObj.material;
            if (Array.isArray(m)) m.forEach(mm => mm && mm.dispose && mm.dispose());
            else if (m && typeof m.dispose === 'function') m.dispose();
          }
        });
      } catch {}
      planetsRef.current = [];
      spaceGroupRef.current = null;
    };
  }, []);

  // Trigger Open‑Meteo fetches from sidebar actions
  useEffect(() => {
    if (!apiAction) return;
    const coord = lastCoord ?? { lat: 20, lng: 0, label: 'Selected location' };
    (async () => {
      try {
        setOverlayError(null);
        if (apiAction === 'openmeteo_current') setOverlayMode('current');
        if (apiAction === 'openmeteo_hourly') setOverlayMode('hourly');
        if (apiAction === 'openmeteo_daily') setOverlayMode('daily');
        const w = await fetchWeatherForPoint(coord.lat, coord.lng);
        setPointWeather({ coord, data: w, storm: isStormForecast(w) });
        // Build storm path if windy
        try {
          const speed = w?.current?.wind_speed_10m || 0;
          const directionDeg = (w as any)?.current?.wind_direction_10m || (w as any)?.current?.winddirection || 0; // attempt multiple keys via any-cast
          if (speed > 5) {
            const R = 6371; // km
            const steps = 6;
            const path: Array<{ lat: number; lng: number; size: number; color: string }> = [];
            for (let i = 1; i <= steps; i++) {
              const distanceKm = (speed * 3600 / 1000) * i; // simplistic: 1 hour increments
              const brng = directionDeg * Math.PI / 180;
              const lat1 = coord.lat * Math.PI / 180;
              const lng1 = coord.lng * Math.PI / 180;
              const dR = distanceKm / R;
              const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
              const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
              const newLat = lat2 * 180 / Math.PI;
              const newLng = lng2 * 180 / Math.PI;
              path.push({ lat: newLat, lng: newLng, size: 2, color: '#ff5252' });
            }
            setStormPath(path);
          } else {
            setStormPath([]);
          }
        } catch { setStormPath([]); }
      } catch (e: any) {
        setOverlayError('Failed to fetch weather data');
      }
      finally {
        // signal to parent so repeated clicks of same action still work
        try { onApiConsumed && onApiConsumed(); } catch {}
      }
    })();
    // Do not change camera/zoom here
  }, [apiAction]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 z-0 m-0 p-0">
      <Globe
        ref={globeEl}
        // higher-resolution base map to reduce blur (large image; may increase load time)
        // progressive image (low-res -> high-res)
        globeImageUrl={globeImage}
        bumpImageUrl={bumpImage}
        showAtmosphere={true}
        atmosphereColor="#6bbcff"
        atmosphereAltitude={0.15}
        // subtle cloud layer for realism (optional)
        backgroundColor="rgba(0,0,0,0)"
        pointsData={[...points, ...stormPath]}
        pointLat="lat"
        pointLng="lng"
        // Remove vertical cylinder look: keep points flat on the globe
        pointAltitude={() => 0}
        pointRadius={(d: any) => Math.max(0.6, d.size / 2)}
        pointColor={(d: any) => d.color}
        onPointClick={async (d: any) => {
          // center on click & fetch weather
          if (globeEl.current) globeEl.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.4 }, 600);
          setLastCoord({ lat: d.lat, lng: d.lng, label: d.label });
          try {
            const w = await fetchWeatherForPoint(d.lat, d.lng);
            setPointWeather({ coord: { lat: d.lat, lng: d.lng, label: d.label }, data: w, storm: isStormForecast(w) });
          } catch {}
        }}
        onGlobeClick={(evt: any) => {
          // evt: { lat, lng, clientX, clientY }
          const lat = evt && typeof evt.lat === 'number' ? evt.lat : (evt && evt[0]);
          const lng = evt && typeof evt.lng === 'number' ? evt.lng : (evt && evt[1]);
          if (typeof lat !== 'number') return;
          // If near poles (85 degrees or more), show polar overlay with real temperature
          if (Math.abs(lat) >= 85) {
            const useLat = lat > 0 ? 89.9999 : -89.9999;
            const useLng = typeof lng === 'number' ? lng : 0;
            setPolarInfo({ lat: useLat, lng: useLng, loading: true });
            // fetch temperature for the polar coord
            (async () => {
              try {
                const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLng}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=3`);
                if (!r.ok) return setPolarInfo(prev => prev ? { ...prev, current: null, daily: null, loading: false } : null);
                const j = await r.json();
                const current = j.current_weather || null;
                const daily = j.daily || null;
                setPolarInfo(prev => prev ? { ...prev, current, daily, loading: false } : { lat: useLat, lng: useLng, current, daily, loading: false });
              } catch (e) {
                setPolarInfo(prev => prev ? { ...prev, current: null, daily: null, loading: false } : null);
              }
            })();
          }
        }}
        polygonsData={countries}
        polygonLabel={(p: any) => p.properties && p.properties.name}
        polygonCapColor={() => 'rgba(0,0,0,0)'}
        polygonSideColor={() => 'rgba(255,255,255,0.06)'}
        polygonStrokeColor={() => 'rgba(200,200,200,0.15)'}
        polygonAltitude={() => 0.01}
        onPolygonClick={(p: any) => {
          // compute robust centroid via 3D averaging (handles dateline and multipolygons)
          try {
            if (!p || !p.geometry || !p.geometry.coordinates) return;
            const coords = p.geometry.coordinates;
            const pts: Array<[number, number]> = [];
            const collect = (arr: any) => {
              if (!Array.isArray(arr)) return;
              if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
                pts.push([arr[0], arr[1]]);
                return;
              }
              for (const a of arr) collect(a);
            };
            collect(coords);
            if (pts.length === 0) return;

            // average as 3D unit vectors
            let x = 0, y = 0, z = 0;
            let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
            for (const [lon, lat] of pts) {
              const radLon = lon * Math.PI / 180;
              const radLat = lat * Math.PI / 180;
              const cx = Math.cos(radLat) * Math.cos(radLon);
              const cy = Math.cos(radLat) * Math.sin(radLon);
              const cz = Math.sin(radLat);
              x += cx; y += cy; z += cz;
              if (lon < lonMin) lonMin = lon;
              if (lon > lonMax) lonMax = lon;
              if (lat < latMin) latMin = lat;
              if (lat > latMax) latMax = lat;
            }
            const len = Math.sqrt(x * x + y * y + z * z);
            if (len === 0) return;
            const avgX = x / len, avgY = y / len, avgZ = z / len;
            const centroidLat = Math.asin(avgZ) * 180 / Math.PI;
            const centroidLon = Math.atan2(avgY, avgX) * 180 / Math.PI;

            if (globeEl.current && Number.isFinite(centroidLat) && Number.isFinite(centroidLon)) {
              globeEl.current.pointOfView({ lat: centroidLat, lng: centroidLon, altitude: 1.5 }, 800);
            }

            // keep the full geojson feature so downstream effects can fetch details
            setSelectedCountry(p);
          } catch (e) {
            // ignore
          }
        }}
        polygonsTransitionDuration={300}
        width={globeW}
        height={globeH}
      />
      {/* Point weather overlay */}
      {pointWeather && (
        <div className="absolute right-4 top-4 z-50 w-80">
          <Card>
            <div className="text-sm text-gray-200">
              <div className="font-semibold text-lg text-gray-100">{pointWeather.coord.label || 'Location'}</div>
              <div className="text-xs text-gray-300">{pointWeather.coord.lat.toFixed(2)}, {pointWeather.coord.lng.toFixed(2)}</div>
              {overlayError && (
                <div className="mt-2 text-xs text-red-400">{overlayError}</div>
              )}
              {overlayMode === 'current' && pointWeather.data?.current && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">
                      {(() => {
                        const code = pointWeather.data.current.weather_code;
                        const [icon] = weatherCodeToIcon(typeof code === 'number' ? code : null);
                        return icon;
                      })()}
                    </div>
                    <div className="text-xs text-gray-300">Current conditions</div>
                  </div>
                  <div>Temp: <span className="font-medium text-gray-100">{Math.round(pointWeather.data.current.temperature_2m)}°C</span></div>
                  <div>Wind: <span className="font-medium text-gray-100">{Math.round(pointWeather.data.current.wind_speed_10m ?? 0)} m/s</span></div>
                  <div>Gusts: <span className="font-medium text-gray-100">{Math.round(pointWeather.data.current.wind_gusts_10m ?? 0)} m/s</span></div>
                  <div>Precip: <span className="font-medium text-gray-100">{Math.round(pointWeather.data.current.precipitation ?? 0)} mm</span></div>
                </div>
              )}
              {overlayMode === 'hourly' && pointWeather.data?.hourly && Array.isArray(pointWeather.data.hourly.temperature_2m) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Next hours</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    {pointWeather.data.hourly.temperature_2m.slice(0,6).map((t:number, i:number) => (
                      <div key={i} className="p-1 rounded bg-gray-800/40 border border-white/10">
                        <div className="font-medium text-gray-100">{Math.round(t)}°C</div>
                        <div className="text-[10px] text-gray-300">Gust {Math.round((pointWeather.data.hourly.wind_gusts_10m?.[i] ?? 0))} m/s</div>
                        <div className="text-[10px] text-gray-300">Precip {Math.round((pointWeather.data.hourly.precipitation?.[i] ?? 0))} mm</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {overlayMode === 'daily' && pointWeather.data?.daily && Array.isArray(pointWeather.data.daily.temperature_2m_max) && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Next days</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    {pointWeather.data.daily.temperature_2m_max.slice(0,3).map((max:number, i:number) => {
                      const min = pointWeather.data.daily.temperature_2m_min?.[i];
                      const code = pointWeather.data.daily.weather_code?.[i];
                      const [icon] = weatherCodeToIcon(typeof code === 'number' ? code : null);
                      return (
                        <div key={i} className="p-1 rounded bg-gray-800/40 border border-white/10 text-center">
                          <div className="text-xl">{icon}</div>
                          <div className="font-medium text-gray-100">{Math.round(max)}°/{Math.round(min ?? max)}°</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mt-3">
                <button onClick={() => setPointWeather(null)} className="mt-2 w-full glass-button text-white py-2">Close</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Polar overlay when user clicks near the poles */}
      {polarInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70">
          <div className="max-w-md w-full px-6">
            <Card>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold text-gray-100">{polarInfo.lat > 0 ? 'North Pole' : 'South Pole'}</div>
                  <div className="text-sm text-gray-300">Coordinates: {polarInfo.lat.toFixed(4)}, {polarInfo.lng.toFixed(4)}</div>
                </div>
                <button
                  onClick={() => { setPolarInfo(null); }}
                  className="ml-4 inline-flex items-center justify-center h-8 w-8 rounded glass-button"
                  aria-label="Close polar overlay"
                >✕</button>
              </div>

              <div className="mt-4 text-gray-200">
                {polarInfo.loading && <div className="text-sm text-gray-400">Loading temperature…</div>}
                {!polarInfo.loading && (!polarInfo.current) && (
                  <div className="text-sm text-gray-400">Temperature data not available.</div>
                )}
                {!polarInfo.loading && polarInfo.current && (
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white">{Math.round(polarInfo.current.temperature)}°C</div>
                    <div className="text-sm text-gray-300 mt-1">Real-time temperature at the pole</div>
                    <div className="mt-3">
                      <div className="font-medium text-sm text-gray-200">3-Day Forecast</div>
                      {polarInfo.daily ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {Array.from({ length: Math.min(3, (polarInfo.daily.time || []).length) }).map((_, i) => {
                            const date = polarInfo.daily.time[i];
                            const max = polarInfo.daily.temperature_2m_max[i];
                            const min = polarInfo.daily.temperature_2m_min[i];
                            const code = polarInfo.daily.weathercode ? polarInfo.daily.weathercode[i] : null;
                            const [icon] = (typeof code === 'number') ? weatherCodeToIcon(code) : ['❓','N/A'];
                            return (
                              <div key={i} className="text-center text-xs">
                                <div className="text-2xl">{icon}</div>
                                <div className="truncate">{new Date(date).toLocaleDateString()}</div>
                                <div className="text-gray-300">{Math.round(max)}° / {Math.round(min)}°</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 mt-1">No forecast available.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Configure renderer pixel ratio and texture anisotropy once globe is mounted */}
      {selectedCountry && (
        <div className="absolute left-4 bottom-4 z-50 w-80">
          <Card>
            <div className="text-sm text-gray-200">
              <div className="font-semibold text-lg">{selectedCountry.properties?.name || selectedCountry.properties?.ADMIN || 'Country'}</div>
              {!countryDetails && (
                <div className="mt-2 text-xs text-gray-400">Loading country details…</div>
              )}
              {countryDetails && (
                <div className="mt-2">
                  <div className="text-sm text-gray-300">Capital: <span className="font-medium text-gray-100">{(countryDetails.capital && countryDetails.capital[0]) || '—'}</span></div>
                  <div className="text-sm text-gray-300">Region: <span className="font-medium text-gray-100">{countryDetails.region || '—'}</span></div>
                  <div className="text-sm text-gray-300">Population: <span className="font-medium text-gray-100">{countryDetails.population ? countryDetails.population.toLocaleString() : '—'}</span></div>
                  {countryDetails.flags && countryDetails.flags.svg && (
                    <img src={countryDetails.flags.svg} alt="flag" className="mt-2 h-10 w-auto border rounded" />
                  )}

                  <div className="mt-3">
                    <div className="font-semibold text-sm text-gray-200">Current Weather</div>
                    {weatherLoading && <div className="text-xs text-gray-400 mt-1">Loading weather…</div>}
                    {!weatherLoading && !countryWeather && (
                      <div className="text-xs text-gray-400 mt-1">No weather data available.</div>
                    )}
                    {countryWeather && (
                      <div className="mt-1 text-sm text-gray-300">
                        <div>Temperature: <span className="font-medium text-gray-100">{countryWeather.current?.temperature ?? '—'}°C</span></div>
                        <div>Wind Speed: <span className="font-medium text-gray-100">{countryWeather.current?.windspeed ?? '—'} m/s</span></div>
                        <div>Wind Dir: <span className="font-medium text-gray-100">{countryWeather.current?.winddirection ?? '—'}°</span></div>
                        <div className="text-xs text-gray-400">Last update: {countryWeather.current?.time ? new Date(countryWeather.current.time).toLocaleString() : '—'}</div>

                        {/* small forecast */}
                        {countryWeather.daily && (
                          <div className="mt-2">
                            <div className="font-medium text-sm text-gray-200">3-Day Forecast</div>
                            <div className="mt-1 grid grid-cols-3 gap-2">
                              {Array.from({ length: Math.min(3, (countryWeather.daily.time || []).length) }).map((_, i) => {
                                const date = countryWeather.daily.time[i];
                                const max = countryWeather.daily.temperature_2m_max[i];
                                const min = countryWeather.daily.temperature_2m_min[i];
                                const code = countryWeather.daily.weathercode ? countryWeather.daily.weathercode[i] : null;
                                const [icon] = (typeof code === 'number') ? weatherCodeToIcon(code) : ['❓','N/A'];
                                return (
                                  <div key={i} className="text-center text-xs">
                                    <div className="text-2xl">{icon}</div>
                                    <div className="truncate">{new Date(date).toLocaleDateString()}</div>
                                    <div className="text-gray-300">{Math.round(max)}° / {Math.round(min)}°</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GlobeMap;
