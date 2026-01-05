import { HazardEvent, InfrastructureSite } from '../types';
import { fetchFEMADisasters, getFEMADisasterCoords, getFEMACategory } from './fema';

// --- LIVE FETCH (STORMS + FEMA DISASTERS) ---
// Storm events via NASA EONET open events API (no key required).
// FEMA disasters via OpenFEMA API (no key required).
// Infrastructure sample via Overpass API (OpenStreetMap) still includes fallback (confirm with user if removal desired).

const EONET_BASE = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Build constrained Overpass query around a coarse world bounding box for limited infra types
// For better performance, this could be adapted to the current viewport center & radius.
const overpassQuery = `[out:json][timeout:25];(
  node["amenity"="hospital"](40,-130,60,-60); // slice (roughly N. America/Europe sample)
  node["power"="plant"](40,-130,60,-60);
  node["harbour"](40,-130,60,-60);
  node["amenity"="shelter"](40,-130,60,-60);
);out center 50;`;

function safeFetch(url: string, init?: RequestInit): Promise<any> {
  return fetch(url, init).then(r => {
    if (!r.ok) throw new Error(`Request failed ${r.status}`);
    return r.json();
  });
}

export async function fetchHazardEvents(): Promise<HazardEvent[]> {
  const now = Date.now();
  const hazards: HazardEvent[] = [];
  
  // Fetch NASA EONET events (all categories, not just storms)
  try {
    const eonet = await safeFetch(`${EONET_BASE}?status=open&limit=100`);
    if (Array.isArray(eonet?.events)) {
      for (const ev of eonet.events) {
        const catTitle = (ev.categories?.[0]?.title || '').toLowerCase();
        const geom = ev.geometry?.[0];
        if (!geom || typeof geom.coordinates?.[1] !== 'number' || typeof geom.coordinates?.[0] !== 'number') continue;
        
        // Map EONET categories to our categories
        let category: HazardEvent['category'] = 'Storm';
        if (catTitle.includes('wildfire') || catTitle.includes('fire')) category = 'Wildfire';
        else if (catTitle.includes('flood')) category = 'Flood';
        else if (catTitle.includes('earthquake') || catTitle.includes('seismic')) category = 'Earthquake';
        else if (catTitle.includes('storm') || catTitle.includes('cyclone') || catTitle.includes('hurricane')) category = 'Storm';
        
        const intensity = Math.min(10, Math.max(1, (ev.geometry?.length || 1))); // crude proxy: number of geometry entries
        
        // Derive a cleaner display name from the event title.
        let rawTitle = ev.title || 'Unnamed Event';
        // Remove category prefixes like "Severe Storms -" or similar.
        rawTitle = rawTitle.replace(/^(Severe\s*Storms\s*-\s*)/i, '').trim();
        // Remove trailing parenthetical metadata e.g. " (USA)" if desired.
        rawTitle = rawTitle.replace(/\s*\([^)]*\)\s*$/,'').trim();
        // Collapse multiple spaces
        rawTitle = rawTitle.replace(/\s{2,}/g,' ');
        
        hazards.push({
          id: `eonet-${ev.id}`,
          title: rawTitle || 'Unnamed Event',
          category,
          lat: geom.coordinates[1],
          lng: geom.coordinates[0],
          intensity,
          detectedAt: geom.date || new Date(now).toISOString(),
          source: 'NASA EONET'
        });
      }
    }
  } catch (e) {
    console.error('Error fetching EONET events:', e);
    // Continue without EONET data
  }
  
  // Fetch FEMA disasters
  try {
    const femaDisasters = await fetchFEMADisasters(100, 180); // Last 180 days, up to 100 records
    for (const disaster of femaDisasters) {
      const coords = getFEMADisasterCoords(disaster);
      if (!coords) continue; // Skip if no coordinates available
      
      const category = getFEMACategory(disaster.incidentType);
      const intensity = Math.floor(Math.random() * 5) + 3; // Random intensity 3-7
      
      hazards.push({
        id: `fema-${disaster.disasterNumber}`,
        title: disaster.disasterName,
        category,
        lat: coords.lat,
        lng: coords.lng,
        intensity,
        detectedAt: disaster.declarationDate || new Date(now).toISOString(),
        source: 'FEMA'
      });
    }
  } catch (e) {
    console.error('Error fetching FEMA disasters:', e);
    // Continue without FEMA data
  }
  
  console.log(`Fetched ${hazards.length} hazard events`);
  return hazards; // may be empty
}

export async function fetchInfrastructureSites(): Promise<InfrastructureSite[]> {
  const now = Date.now();
  const sites: InfrastructureSite[] = [];
  try {
    const body = new URLSearchParams({ data: overpassQuery });
    const resp = await fetch(OVERPASS_URL, { method: 'POST', body });
    if (!resp.ok) throw new Error('Overpass request failed');
    const json = await resp.json();
    if (Array.isArray(json?.elements)) {
      for (const el of json.elements.slice(0, 60)) { // cap to 60 nodes
        if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
        const tags = el.tags || {};
        let type: InfrastructureSite['type'] | null = null;
        if (tags.amenity === 'hospital') type = 'Hospital';
        else if (tags.power === 'plant') type = 'Power Plant';
        else if (tags.harbour) type = 'Port';
        else if (tags.amenity === 'shelter') type = 'Shelter';
        if (!type) continue;
        sites.push({
          id: `osm-${el.id}`,
          name: tags.name || (type + ' (OSM)'),
          type,
          lat: el.lat,
          lng: el.lon,
          status: 'Operational', // no live status in OSM; default
          lastUpdated: new Date(now).toISOString()
        });
      }
    }
  } catch (e) {
    // fallback minimal mock
    const t = new Date(now).toISOString();
    if (!sites.length) {
      sites.push(
        { id: 'mock-hospital', name: 'Central Hospital', type: 'Hospital', lat: 51.5, lng: -0.11, status: 'Operational', lastUpdated: t },
        { id: 'mock-power', name: 'Grid Plant', type: 'Power Plant', lat: 38.55, lng: -121.50, status: 'Degraded', lastUpdated: t }
      );
    }
  }
  return sites;
}

export interface CombinedOverlayPoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  kind: 'hazard' | 'infrastructure';
  original: HazardEvent | InfrastructureSite;
}

export function transformHazards(hazards: HazardEvent[]): CombinedOverlayPoint[] {
  return hazards.map(h => {
    // Color based on category
    let color = '#3b82f6'; // default blue
    const cat = h.category.toLowerCase();
    if (cat === 'wildfire') color = '#fb923c'; // orange
    else if (cat === 'flood') color = '#22d3ee'; // cyan
    else if (cat === 'earthquake') color = '#a855f7'; // purple
    else if (cat === 'storm') color = '#6366f1'; // indigo
    
    return {
      lat: h.lat,
      lng: h.lng,
      size: Math.min(6, 2 + h.intensity / 2),
      color,
      label: h.title,
      kind: 'hazard' as const,
      original: h
    };
  });
}

export function transformInfrastructure(sites: InfrastructureSite[]): CombinedOverlayPoint[] {
  return sites.map(s => ({
    lat: s.lat,
    lng: s.lng,
    size: s.status === 'Operational' ? 1.4 : s.status === 'Degraded' ? 2.0 : 2.4,
    color: s.status === 'Operational' ? '#10b981' : s.status === 'Degraded' ? '#f59e0b' : '#dc2626',
    label: s.name,
    kind: 'infrastructure',
    original: s
  }));
}

export async function fetchLiveOverlay(): Promise<CombinedOverlayPoint[]> {
  const [hazards, infra] = await Promise.all([
    fetchHazardEvents(),
    fetchInfrastructureSites()
  ]);
  return [...transformHazards(hazards), ...transformInfrastructure(infra)];
}
