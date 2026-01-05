import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import { fetchLiveOverlay } from '../services/hazards';
import { fetchWeatherForPoint, isStormForecast } from '../services/openMeteo';
import Card from './ui/Card';
import DisasterDetailPanel from './DisasterDetailPanel';

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
  dataType: 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  focusCoord?: { lat: number; lng: number; label?: string } | undefined;
  infraHazardsEnabled?: boolean;
}

const GlobeMap: React.FC<GlobeMapProps> = ({ dataType, climateData, disasters, environmentalData, focusCoord, infraHazardsEnabled }) => {
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
  const lowResGlobe = './8081_earthmap10k.jpg';
  const highResGlobe = './8081_earthmap10k.jpg';
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

  // Fetch weather for selected country
  useEffect(() => {
    let mounted = true;
    setCountryWeather(null);
    setWeatherLoading(false);
    
    if (!countryDetails) return;
    
    const fetchWeather = async () => {
      try {
        // Get capital coordinates or use country center
        const lat = countryDetails.capitalInfo?.latlng?.[0] || countryDetails.latlng?.[0];
        const lng = countryDetails.capitalInfo?.latlng?.[1] || countryDetails.latlng?.[1];
        
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        
        // Check cache first
        const cacheKey = `${countryDetails.cca3 || countryDetails.name?.common}`;
        if (weatherCacheRef.current.has(cacheKey)) {
          if (mounted) setCountryWeather(weatherCacheRef.current.get(cacheKey));
          return;
        }
        
        setWeatherLoading(true);
        const weather = await fetchWeatherForPoint(lat, lng);
        
        if (mounted && weather) {
          // Cache the result
          weatherCacheRef.current.set(cacheKey, weather);
          setCountryWeather(weather);
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    };
    
    fetchWeather();
    return () => { mounted = false; };
  }, [countryDetails, selectedCountry]);

  // When focusCoord changes (e.g., from search), fetch weather for that location
  useEffect(() => {
    if (!focusCoord) return;
    let mounted = true;
    
    (async () => {
      try {
        const [aqiRes, weatherRes] = await Promise.allSettled([
          fetchNearestAQI(focusCoord.lat, focusCoord.lng),
          fetchWeatherForPoint(focusCoord.lat, focusCoord.lng),
        ]);
        
        if (!mounted) return;
        
        if (aqiRes.status === 'fulfilled' && aqiRes.value) setPointAQI(aqiRes.value);
        else setPointAQI(null);

        if (weatherRes.status === 'fulfilled' && weatherRes.value) {
          setPointWeather({ 
            coord: { lat: focusCoord.lat, lng: focusCoord.lng, label: focusCoord.label || 'Location' }, 
            data: weatherRes.value, 
            original: null 
          });
        } else {
          setPointWeather({ 
            coord: { lat: focusCoord.lat, lng: focusCoord.lng, label: focusCoord.label || 'Location' }, 
            data: null, 
            original: null 
          });
        }
      } catch (e) {
        if (mounted) {
          setPointAQI(null);
          setPointWeather({ 
            coord: { lat: focusCoord.lat, lng: focusCoord.lng, label: focusCoord.label || 'Location' }, 
            data: null, 
            original: null 
          });
        }
      }
    })();
    
    return () => { mounted = false; };
  }, [focusCoord]);

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
  const [pointAQI, setPointAQI] = useState<{ value: number; parameter: string; unit: string; category: string } | null>(null);
  const fetchNearestAQI = async (lat: number, lng: number) => {
    try {
      const base = 'https://api.openaq.org/v2/latest';
      const params = new URLSearchParams({
        coordinates: `${lat},${lng}`,
        radius: '50000',
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
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [overlayMode, setOverlayMode] = useState<'current' | 'hourly' | 'daily'>('current');
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [stormPath, setStormPath] = useState<Array<{ lat: number; lng: number; size: number; color: string }>>([]);
  const [infraPoints, setInfraPoints] = useState<Array<{ lat: number; lng: number; size: number; color: string; label: string; kind: string; original: any }>>([]);
  const [infraLoading, setInfraLoading] = useState(false);
  const [infraError, setInfraError] = useState<string | null>(null);

  // Space background and planets
  const spaceGroupRef = useRef<any>(null);
  const planetsRef = useRef<Array<{ mesh: any; orbitRadius: number; speed: number; angle: number; selfRot: number }>>([]);
  const animRef = useRef<number | null>(null);
  const clockRef = useRef<any>(null);
  const [auroraEnabled] = useState<boolean>(true);
  const auroraGroupRef = useRef<any>(null);

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
      // When external focus is set (from search or selection), just move the camera.
      // Avoid fetching weather here to prevent network-induced UI stalls.
      if (!focusCoord) return;
      try {
        if (globeEl.current) globeEl.current.pointOfView({ lat: focusCoord.lat, lng: focusCoord.lng, altitude: 1.4 }, 300);
        // Record last focused coordinate for UI state only
        setLastCoord(focusCoord);
        // Do NOT fetch weather here (was causing lag); keep point weather updates on explicit user interactions.
      } catch (e) {
        // ignore
      }
    }, [focusCoord]);

  // Single pin-like label at the last selected/search coordinate
  const pinLabel = useMemo(() => {
    const c = lastCoord || focusCoord;
    if (!c) return [] as Array<{ lat: number; lng: number; label?: string }>;
    return [{ lat: c.lat, lng: c.lng, label: c.label || '' }];
  }, [lastCoord?.lat, lastCoord?.lng, focusCoord?.lat, focusCoord?.lng]);

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

    // Aurora Borealis/Australis effect near poles
    if (auroraEnabled) {
      const auroraGroup = new THREE.Group();
      auroraGroupRef.current = auroraGroup;
      // simple shader-based ribbon using time-based noise
      const auroraFrag = `
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p){
          p = 50.0 * fract(p * 0.3183099 + vec2(0.71,0.113));
          return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
        }
        float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          float a = hash(i + vec2(0.0,0.0));
          float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0));
          float d = hash(i + vec2(1.0,1.0));
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }
        void main(){
          float t = uTime * 0.15;
          float n = noise(vUv * 8.0 + vec2(t, t*0.7));
          float band = smoothstep(0.2, 0.85, n);
          vec3 col = mix(vec3(0.05,0.2,0.4), vec3(0.1,0.8,0.4), band);
          col += 0.2 * vec3(0.2, 0.9, 0.6) * band;
          gl_FragColor = vec4(col, band * 0.75);
        }
      `;
      const auroraVert = `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const makeAuroraRing = (radius: number, latDeg: number) => {
        const geo = new THREE.RingGeometry(radius * 0.92, radius * 1.08, 128, 1);
        const mat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: auroraVert,
          fragmentShader: auroraFrag,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        // position slightly above the globe surface
        // react-globe.gl uses a globe radius of ~100 units by default
        const globeRadius = 100;
        const altitude = 6; // above surface
        const lat = THREE.MathUtils.degToRad(latDeg);
        const y = Math.sin(lat) * (globeRadius + altitude);
        const rOnPlane = Math.cos(lat) * (globeRadius + altitude);
        mesh.rotation.x = Math.PI / 2; // lie flat, then place on y
        mesh.position.set(0, y, 0);
        mesh.scale.set(rOnPlane, rOnPlane, 1);
        auroraGroup.add(mesh);
        return mesh as any;
      };

      // Create two rings for north and south auroras
      const north = makeAuroraRing(1.0, 70); // around Arctic Circle
      const south = makeAuroraRing(1.0, -70); // around Antarctic Circle
      group.add(auroraGroup);

      // Animate uniform time via the same clock
      const updateAurora = (dt: number) => {
        [north, south].forEach((m: any) => {
          if (m && m.material && m.material.uniforms && m.material.uniforms.uTime) {
            m.material.uniforms.uTime.value += dt;
          }
        });
        // slow wavering
        auroraGroup.rotation.y += dt * 0.03;
      };

      // Hook into existing animate via closure below
      (auroraGroup as any)._update = updateAurora;
    }

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
      // update aurora
      try {
        const aur = auroraGroupRef.current;
        if (aur && (aur as any)._update) {
          (aur as any)._update(dt);
        }
      } catch {}
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
        if (auroraGroupRef.current) {
          try { scene.remove(auroraGroupRef.current); } catch {}
          auroraGroupRef.current = null;
        }
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

  

  // Infrastructure + Hazard overlay fetch once when enabled (timer removed)
  useEffect(() => {
    if (!infraHazardsEnabled) { setInfraPoints([]); setInfraError(null); return; }
    let mounted = true;
    (async () => {
      setInfraLoading(true);
      setInfraError(null);
      try {
        const merged = await fetchLiveOverlay();
        if (mounted) setInfraPoints(merged as any);
      } catch (e:any) {
        if (mounted) {
          setInfraPoints([]);
          setInfraError('Overlay fetch failed');
        }
      } finally {
        if (mounted) setInfraLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [infraHazardsEnabled]);

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
        pointsData={showData ? [...points, ...stormPath, ...infraPoints] : []}
        pointLat="lat"
        pointLng="lng"
        // Elevate points above polygons so they're always clickable
        pointAltitude={(d: any) => {
          // Hazard/disaster points should be higher than regular points
          if (d.kind === 'hazard' || d.original?.category || d.original?.intensity) {
            return 0.015; // Higher altitude for disasters
          }
          return 0.005; // Lower altitude for regular points
        }}
        pointRadius={(d: any) => {
          // Make disaster/hazard points larger and more clickable
          if (d.kind === 'hazard' || d.original?.category || d.original?.intensity) {
            return Math.max(1.2, d.size / 1.5); // Larger radius for disasters
          }
          return Math.max(0.6, d.size / 2);
        }}
        pointColor={(d: any) => {
          // Respect explicit color if provided
          if (d.color) return d.color;
          const kind = (d.kind || d.type || d.original?.type || '').toLowerCase();
          const status = (d.status || d.original?.status || '').toLowerCase();
          // Infrastructure status mapping
          if (status) {
            if (status.includes('operational')) return '#10b981'; // green
            if (status.includes('degraded')) return '#f59e0b';   // amber
            if (status.includes('offline')) return '#ef4444';    // red
          }
          // Hazard type mapping
          if (kind) {
            if (kind.includes('wildfire')) return '#fb923c';     // orange
            if (kind.includes('storm') || kind.includes('cyclone') || kind.includes('hurricane')) return '#6366f1'; // indigo
            if (kind.includes('flood')) return '#22d3ee';        // cyan
          }
          // Fallbacks
          if (d.original && typeof d.original.temperature === 'number') {
            return d.original.temperature > 25 ? '#ef4444' : '#3b82f6';
          }
          if (d.original && d.original.severity) {
            const sev = String(d.original.severity).toLowerCase();
            if (sev === 'high') return '#dc2626';
            if (sev === 'medium') return '#f59e0b';
            return '#fbbf24';
          }
          return '#93c5fd';
        }}
        // Pin-like dot label for searched/selected place
        labelsData={pinLabel}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => {
          const base = d.label || '';
          return base;
        }}
        labelSize={1.1}
        labelDotRadius={0.7}
        // match app theme: soft, light text
        labelColor={() => 'rgba(229, 231, 235, 0.95)'}
        labelAltitude={0.01}
        onPointClick={async (d: any) => {
          // Check if this is a disaster/hazard point
          const isDisaster = d.kind === 'hazard' || d.original?.category || d.original?.intensity || d.original?.source;
          
          if (isDisaster) {
            // Show disaster detail panel
            const disasterData = {
              id: d.original?.id || d.id || 'unknown',
              title: d.original?.title || d.label || 'Unknown Event',
              category: d.original?.category || d.original?.type || 'Event',
              lat: d.lat,
              lng: d.lng,
              intensity: d.original?.intensity,
              detectedAt: d.original?.detectedAt || d.original?.timestamp,
              source: d.original?.source,
              description: d.original?.description,
              severity: d.original?.severity,
              type: d.original?.type,
              status: d.original?.status
            };
            setSelectedDisaster(disasterData);
            return;
          }
          
          // For non-disaster points, center and fetch AQI + weather and expose original data
          if (globeEl.current) globeEl.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.4 }, 600);
          setLastCoord({ lat: d.lat, lng: d.lng, label: d.label });
          setPointAQI(null);
          setPointWeather(null);
          // Fetch AQI and weather in parallel but tolerate failures
          try {
            const [aqiRes, weatherRes] = await Promise.allSettled([
              fetchNearestAQI(d.lat, d.lng),
              fetchWeatherForPoint(d.lat, d.lng),
            ]);
            if (aqiRes.status === 'fulfilled' && aqiRes.value) setPointAQI(aqiRes.value);
            else setPointAQI(null);

            if (weatherRes.status === 'fulfilled' && weatherRes.value) {
              setPointWeather({ coord: { lat: d.lat, lng: d.lng, label: d.label }, data: weatherRes.value, original: d.original });
            } else {
              // still expose original data even if weather failed
              setPointWeather({ coord: { lat: d.lat, lng: d.lng, label: d.label }, data: null, original: d.original });
            }
          } catch (e) {
            setPointAQI(null);
            setPointWeather({ coord: { lat: d.lat, lng: d.lng, label: d.label }, data: null, original: d.original });
          }
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
            
            // Fetch weather data for polar region
            (async () => {
              try {
                const weather = await fetchWeatherForPoint(useLat, useLng);
                setPolarInfo(prev => prev ? { ...prev, current: weather?.current, daily: weather?.daily, loading: false } : null);
              } catch (error) {
                console.error('Error fetching polar weather:', error);
                setPolarInfo(prev => prev ? { ...prev, loading: false } : null);
              }
            })();
          }
        }}
        polygonsData={countries}
        polygonLabel={(p: any) => p.properties && p.properties.name}
        polygonCapColor={(p: any) => (p === selectedCountry ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0)')}
        polygonSideColor={(p: any) => (p === selectedCountry ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)')}
        polygonStrokeColor={(p: any) => (p === selectedCountry ? 'rgba(59,130,246,0.9)' : 'rgba(200,200,200,0.15)')}
        polygonAltitude={(p: any) => (p === selectedCountry ? 0.008 : 0.001)}
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
      {/* Country weather overlay (top-right) */}
      {selectedCountry && (
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

      {/* Point weather overlay removed - using district weather panel in App.tsx instead */}

      {infraHazardsEnabled && (
        <div className="absolute right-4 bottom-32 z-40 w-64 pointer-events-none">
          <div className="text-[11px] text-gray-300 space-y-1 pointer-events-auto">
            {infraLoading && <div className="animate-pulse text-gray-400">Fetching overlay…</div>}
            {infraError && <div className="text-red-400">{infraError}</div>}
            {!infraLoading && !infraError && infraPoints.length === 0 && <div className="text-gray-400">No points returned.</div>}
          </div>
        </div>
      )}

      {/* Polar overlay when user clicks near the poles */}
      {polarInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md w-full px-4 sm:px-6">
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
                    <div className="text-5xl font-bold text-white">{Math.round(polarInfo.current.temperature_2m ?? 0)}°C</div>
                    <div className="text-sm text-gray-300 mt-1">Real-time temperature at the pole</div>
                    <div className="mt-3">
                      <div className="font-medium text-sm text-gray-200">3-Day Forecast</div>
                      {polarInfo.daily ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {Array.from({ length: Math.min(3, (polarInfo.daily.time || []).length) }).map((_, i) => {
                            const date = polarInfo.daily.time[i];
                            const max = polarInfo.daily.temperature_2m_max[i];
                            const min = polarInfo.daily.temperature_2m_min[i];
                            const code = polarInfo.daily.weather_code ? polarInfo.daily.weather_code[i] : null;
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
