import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';

// Fetch live disaster and environmental data from public APIs (no API key required)
// - EONET (NASA) for natural events: https://eonet.gsfc.nasa.gov
// - USGS for earthquakes: https://earthquake.usgs.gov
// - OpenAQ for recent air quality: https://api.openaq.org
// - Open-Meteo for current weather (temperature) per-location: https://open-meteo.com

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const USGS_EQ_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const OPENAQ_URL = 'https://api.openaq.org/v2/latest';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

async function fetchEonetDisasters(): Promise<DisasterEvent[]> {
  try {
    const res = await fetch(`${EONET_URL}?status=open`);
    if (!res.ok) return [];
    const json = await res.json();
    const events = json.events || [];
    const disasters: DisasterEvent[] = [];

    events.forEach((ev: any, idx: number) => {
      // Use most recent geometry
      const geom = Array.isArray(ev.geometry) && ev.geometry.length > 0 ? ev.geometry[ev.geometry.length - 1] : null;
      if (!geom) return;
      const coords = geom.coordinates; // may be [lon, lat] or nested arrays for polygons/multipoints
      if (!coords) return;

      // Helper to find a numeric lon/lat pair inside possibly nested coordinate arrays
      const findLonLat = (c: any): [number, number] | null => {
        if (!c) return null;
        // If it's already a pair of numbers
        if (typeof c[0] === 'number' && typeof c[1] === 'number') return [c[0], c[1]];
        // If it's an array, try its first element (may be nested)
        if (Array.isArray(c) && c.length > 0) return findLonLat(c[0]);
        return null;
      };

      const pair = findLonLat(coords);
      if (!pair) return;
      const [lon, lat] = pair;

      // ensure numbers
      const numLat = Number(lat);
      const numLon = Number(lon);
      if (!isFinite(numLat) || !isFinite(numLon)) return;

      disasters.push({
        id: `eonet-${ev.id || idx}`,
        type: ev.title || (ev.categories && ev.categories[0] && ev.categories[0].title) || 'Event',
        location: ev.title || 'Unknown',
        lat: numLat,
        lng: numLon,
        severity: 'Medium',
        timestamp: geom.date || new Date().toISOString(),
        description: ev.description || ev.title || ''
      });
    });

    return disasters;
  } catch (e) {
    console.error('EONET fetch error', e);
    return [];
  }
}

async function fetchUSGSEarthquakes(): Promise<DisasterEvent[]> {
  try {
    const res = await fetch(USGS_EQ_URL);
    if (!res.ok) return [];
    const json = await res.json();
    const features = json.features || [];
    return features.map((f: any, i: number) => {
      const mag = f.properties && f.properties.mag ? f.properties.mag : 0;
      const severity = mag >= 5 ? 'High' : mag >= 4 ? 'Medium' : 'Low';
      const coords = f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [0, 0];
      const lon = coords[0];
      const lat = coords[1];
      return {
        id: `usgs-${f.id || i}`,
        type: 'Earthquake',
        location: f.properties && f.properties.place ? f.properties.place : 'Unknown',
        lat: parseFloat(lat),
        lng: parseFloat(lon),
        severity: severity as 'Low' | 'Medium' | 'High',
        timestamp: new Date((f.properties && f.properties.time) || Date.now()).toISOString(),
        description: `Magnitude ${mag}`
      } as DisasterEvent;
    });
  } catch (e) {
    console.error('USGS fetch error', e);
    return [];
  }
}

async function fetchOpenAQ(limit = 100): Promise<EnvironmentalData[]> {
  try {
    const url = `${OPENAQ_URL}?limit=${limit}&page=1&offset=0&sort=desc&order_by=lastUpdated`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const results = json.results || [];
    const env: EnvironmentalData[] = results.map((r: any, i: number) => {
      const coord = r.coordinates || {};
      // pick pm25 measurement if present
      const pm25 = (r.measurements || []).find((m: any) => m.parameter === 'pm25');
      const value = pm25 ? pm25.value : ((r.measurements && r.measurements[0] && r.measurements[0].value) || 0);
      return {
        id: `openaq-${r.location || i}`,
        location: r.location || r.city || 'Unknown',
        lat: coord.latitude || 0,
        lng: coord.longitude || 0,
        airQuality: Math.round(value),
        co2Level: 400, // OpenAQ doesn't provide CO2; leave as approximate
        pollutionIndex: Math.round((value / 50) * 10) / 10,
        timestamp: (r.measurements && r.measurements[0] && r.measurements[0].lastUpdated) || new Date().toISOString(),
      };
    }).filter((x: EnvironmentalData) => x.lat !== 0 || x.lng !== 0);

    return env;
  } catch (e) {
    console.error('OpenAQ fetch error', e);
    return [];
  }
}

async function fetchOpenMeteoForPoints(points: { lat: number; lng: number; id?: string; location?: string }[]): Promise<ClimateData[]> {
  try {
    const promoted: ClimateData[] = [];
    const requests = points.slice(0, 40).map(async (p, idx) => {
      const url = `${OPEN_METEO_URL}?latitude=${p.lat}&longitude=${p.lng}&current_weather=true`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const cw = json.current_weather;
      if (!cw) return null;
      return {
        id: `omet-${p.id || idx}`,
        location: p.location || `Point ${idx}`,
        lat: p.lat,
        lng: p.lng,
        temperature: Math.round((cw.temperature ?? 0) * 10) / 10,
        humidity: Math.round((cw.relativehumidity ?? 50)),
        windSpeed: Math.round((cw.windspeed ?? 0) * 10) / 10,
        timestamp: new Date().toISOString(),
      } as ClimateData;
    });

    const results = await Promise.all(requests);
    results.forEach(r => { if (r) promoted.push(r); });
    return promoted;
  } catch (e) {
    console.error('Open-Meteo fetch error', e);
    return [];
  }
}

export async function fetchLiveData(): Promise<{ disasters: DisasterEvent[]; environmental: EnvironmentalData[]; climate: ClimateData[] }> {
  // Parallel fetch
  const [eonet, usgs, openaq] = await Promise.all([fetchEonetDisasters(), fetchUSGSEarthquakes(), fetchOpenAQ(120)]);

  // Merge disaster lists (simple concat, dedupe by id)
  const disastersMap = new Map<string, DisasterEvent>();
  [...eonet, ...usgs].forEach(d => disastersMap.set(d.id, d));
  const disasters = Array.from(disastersMap.values());

  // For climate, sample temperatures for top OpenAQ locations
  const points = openaq.slice(0, 40).map(p => ({ lat: p.lat, lng: p.lng, id: p.id, location: p.location }));
  const climate = await fetchOpenMeteoForPoints(points);

  return { disasters, environmental: openaq, climate };
}

export default { fetchLiveData };
