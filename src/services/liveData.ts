import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import { fetchFEMADisasters, getFEMADisasterCoords, getFEMASeverity } from './fema';

// Fetch live disaster and environmental data from public APIs (no API key required)
// - EONET (NASA) for natural events: https://eonet.gsfc.nasa.gov
// - USGS for earthquakes: https://earthquake.usgs.gov
// - OpenAQ for recent air quality: https://api.openaq.org
// (Open-Meteo integration removed)
// - FEMA OpenFEMA for disaster declarations: https://www.fema.gov/about/openfema/api

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const USGS_EQ_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const OPENAQ_URL = 'https://api.openaq.org/v2/latest';
// Open-Meteo removed: no URL configured

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

async function fetchFEMADisastersAsEvents(): Promise<DisasterEvent[]> {
  try {
    const femaDisasters = await fetchFEMADisasters(50, 90); // Last 90 days, up to 50 records
    return femaDisasters.map((disaster, idx) => {
      const coords = getFEMADisasterCoords(disaster);
      if (!coords) return null;
      
      return {
        id: `fema-${disaster.disasterNumber}`,
        type: disaster.incidentType || 'Disaster',
        location: `${disaster.designatedArea || disaster.state}, ${disaster.state}`,
        lat: coords.lat,
        lng: coords.lng,
        severity: getFEMASeverity(disaster.incidentType),
        timestamp: disaster.declarationDate || new Date().toISOString(),
        description: `${disaster.disasterName} - ${disaster.declarationType}`
      } as DisasterEvent;
    }).filter(d => d !== null) as DisasterEvent[];
  } catch (e) {
    console.error('FEMA fetch error', e);
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

// Open-Meteo climate sampling removed to avoid external dependency; returning empty climate data.

export async function fetchLiveData(): Promise<{ disasters: DisasterEvent[]; environmental: EnvironmentalData[]; climate: ClimateData[] }> {
  // Parallel fetch including FEMA
  const [eonet, usgs, fema, openaq] = await Promise.all([
    fetchEonetDisasters(), 
    fetchUSGSEarthquakes(), 
    fetchFEMADisastersAsEvents(),
    fetchOpenAQ(120)
  ]);

  // Merge disaster lists (simple concat, dedupe by id)
  const disastersMap = new Map<string, DisasterEvent>();
  [...eonet, ...usgs, ...fema].forEach(d => disastersMap.set(d.id, d));
  const disasters = Array.from(disastersMap.values());

  // Climate sampling via Open-Meteo has been removed; return empty climate array
  const climate: ClimateData[] = [];

  return { disasters, environmental: openaq, climate };
}

export default { fetchLiveData };
