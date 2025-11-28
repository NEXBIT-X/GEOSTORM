import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import Card from './ui/Card';

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
}

const GlobeMap: React.FC<GlobeMapProps> = ({ dataType, climateData, disasters, environmentalData }) => {
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
  const highResGlobe = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74414/world.200412.3x5400x2700.jpg';
  const [globeImage, setGlobeImage] = useState<string>(lowResGlobe);
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
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2 }, 800);
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

  // Progressive load: preload the high-res image and swap when ready
  useEffect(() => {
    let mounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = highResGlobe;
    img.onload = () => {
      if (!mounted) return;
      setGlobeImage(highResGlobe);
      // reconfigure material quality after image swap
      setTimeout(() => configureQuality(), 50);
    };
    img.onerror = () => { /* keep low-res on error */ };
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

  return (
    <div className="absolute inset-0 z-0">
      <Globe
        ref={globeEl}
        // higher-resolution base map to reduce blur (large image; may increase load time)
        // progressive image (low-res -> high-res)
        globeImageUrl={globeImage}
        // subtle cloud layer for realism (optional)
        backgroundColor="rgba(0,0,0,0)"
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: any) => 0.01 + (d.size / 50)}
        pointRadius={(d: any) => d.size / 2}
        pointColor={(d: any) => d.color}
        onPointClick={(d: any) => {
          // center on click
          if (globeEl.current) globeEl.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 600);
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
          setSelectedCountry(p);
          if (globeEl.current && p && p.properties && p.properties.name) {
            // compute centroid to center
            const coords = p.geometry && p.geometry.coordinates && p.geometry.coordinates[0];
            const lonlat = coords && coords[0] ? coords[0] : null;
            if (p && p.properties && p.properties && lonlat) {
              const lng = lonlat[0];
              const lat = lonlat[1];
              globeEl.current.pointOfView({ lat, lng, altitude: 1.5 }, 800);
            }
          }
        }}
        polygonsTransitionDuration={300}
        width={window.innerWidth}
        height={window.innerHeight}
      />

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
                  className="ml-4 inline-flex items-center justify-center h-8 w-8 rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
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
