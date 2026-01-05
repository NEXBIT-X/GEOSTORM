// FEMA OpenFEMA API integration
// API Documentation: https://www.fema.gov/about/openfema/api

const FEMA_API_BASE = 'https://www.fema.gov/api/open';

// FEMA Disaster Declarations endpoint
const DISASTER_DECLARATIONS_URL = `${FEMA_API_BASE}/v2/DisasterDeclarationsSummaries`;

export interface FEMADisaster {
  disasterNumber: number;
  declarationDate: string;
  disasterName: string;
  incidentType: string;
  state: string;
  declarationType: string;
  incidentBeginDate: string;
  incidentEndDate: string;
  designatedArea: string;
  placeCode: string;
  // Geographic center (not always available in API, need to geocode)
  lat?: number;
  lng?: number;
}



/**
 * Fetch recent FEMA disaster declarations
 * @param limit Maximum number of records to return
 * @param daysBack Number of days to look back from today
 */
export async function fetchFEMADisasters(limit = 50, daysBack = 365): Promise<FEMADisaster[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const dateStr = cutoffDate.toISOString().split('T')[0];
    
    // Query parameters: filter by recent declarations, order by date, limit results
    const params = new URLSearchParams({
      $filter: `declarationDate ge '${dateStr}'`,
      $orderby: 'declarationDate desc',
      $top: String(limit),
      $select: 'disasterNumber,declarationDate,disasterName,incidentType,state,declarationType,incidentBeginDate,incidentEndDate,designatedArea,placeCode'
    });

    const response = await fetch(`${DISASTER_DECLARATIONS_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`FEMA API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.DisasterDeclarationsSummaries || !Array.isArray(data.DisasterDeclarationsSummaries)) {
      return [];
    }

    return data.DisasterDeclarationsSummaries.map((item: any) => ({
      disasterNumber: item.disasterNumber,
      declarationDate: item.declarationDate,
      disasterName: item.disasterName || 'Unnamed Disaster',
      incidentType: item.incidentType || 'Unknown',
      state: item.state || '',
      declarationType: item.declarationType || '',
      incidentBeginDate: item.incidentBeginDate,
      incidentEndDate: item.incidentEndDate,
      designatedArea: item.designatedArea || '',
      placeCode: item.placeCode || ''
    }));
  } catch (error) {
    console.error('Error fetching FEMA disasters:', error);
    return [];
  }
}

/**
 * Get state coordinates (approximate center)
 */
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'AL': { lat: 32.806671, lng: -86.791130 },
  'AK': { lat: 61.370716, lng: -152.404419 },
  'AZ': { lat: 33.729759, lng: -111.431221 },
  'AR': { lat: 34.969704, lng: -92.373123 },
  'CA': { lat: 36.116203, lng: -119.681564 },
  'CO': { lat: 39.059811, lng: -105.311104 },
  'CT': { lat: 41.597782, lng: -72.755371 },
  'DE': { lat: 39.318523, lng: -75.507141 },
  'FL': { lat: 27.766279, lng: -81.686783 },
  'GA': { lat: 33.040619, lng: -83.643074 },
  'HI': { lat: 21.094318, lng: -157.498337 },
  'ID': { lat: 44.240459, lng: -114.478828 },
  'IL': { lat: 40.349457, lng: -88.986137 },
  'IN': { lat: 39.849426, lng: -86.258278 },
  'IA': { lat: 42.011539, lng: -93.210526 },
  'KS': { lat: 38.526600, lng: -96.726486 },
  'KY': { lat: 37.668140, lng: -84.670067 },
  'LA': { lat: 31.169546, lng: -91.867805 },
  'ME': { lat: 44.693947, lng: -69.381927 },
  'MD': { lat: 39.063946, lng: -76.802101 },
  'MA': { lat: 42.230171, lng: -71.530106 },
  'MI': { lat: 43.326618, lng: -84.536095 },
  'MN': { lat: 45.694454, lng: -93.900192 },
  'MS': { lat: 32.741646, lng: -89.678696 },
  'MO': { lat: 38.456085, lng: -92.288368 },
  'MT': { lat: 46.921925, lng: -110.454353 },
  'NE': { lat: 41.125370, lng: -98.268082 },
  'NV': { lat: 38.313515, lng: -117.055374 },
  'NH': { lat: 43.452492, lng: -71.563896 },
  'NJ': { lat: 40.298904, lng: -74.521011 },
  'NM': { lat: 34.840515, lng: -106.248482 },
  'NY': { lat: 42.165726, lng: -74.948051 },
  'NC': { lat: 35.630066, lng: -79.806419 },
  'ND': { lat: 47.528912, lng: -99.784012 },
  'OH': { lat: 40.388783, lng: -82.764915 },
  'OK': { lat: 35.565342, lng: -96.928917 },
  'OR': { lat: 44.572021, lng: -122.070938 },
  'PA': { lat: 40.590752, lng: -77.209755 },
  'RI': { lat: 41.680893, lng: -71.511780 },
  'SC': { lat: 33.856892, lng: -80.945007 },
  'SD': { lat: 44.299782, lng: -99.438828 },
  'TN': { lat: 35.747845, lng: -86.692345 },
  'TX': { lat: 31.054487, lng: -97.563461 },
  'UT': { lat: 40.150032, lng: -111.862434 },
  'VT': { lat: 44.045876, lng: -72.710686 },
  'VA': { lat: 37.769337, lng: -78.169968 },
  'WA': { lat: 47.400902, lng: -121.490494 },
  'WV': { lat: 38.491226, lng: -80.954456 },
  'WI': { lat: 44.268543, lng: -89.616508 },
  'WY': { lat: 42.755966, lng: -107.302490 },
  'DC': { lat: 38.907192, lng: -77.036871 },
  'PR': { lat: 18.220833, lng: -66.590149 },
  'VI': { lat: 18.335765, lng: -64.896335 },
  'GU': { lat: 13.444304, lng: 144.793731 },
  'AS': { lat: -14.270972, lng: -170.132217 },
  'MP': { lat: 15.097969, lng: 145.673370 }
};

/**
 * Get coordinates for a FEMA disaster based on state
 */
export function getFEMADisasterCoords(disaster: FEMADisaster): { lat: number; lng: number } | null {
  const coords = STATE_COORDS[disaster.state];
  if (!coords) return null;
  
  // Add small random offset to prevent exact overlaps
  const offset = 0.5;
  return {
    lat: coords.lat + (Math.random() - 0.5) * offset,
    lng: coords.lng + (Math.random() - 0.5) * offset
  };
}

/**
 * Map FEMA incident type to disaster severity
 */
export function getFEMASeverity(incidentType: string): 'Low' | 'Medium' | 'High' {
  const type = incidentType.toLowerCase();
  
  if (type.includes('hurricane') || type.includes('tornado') || type.includes('earthquake')) {
    return 'High';
  }
  
  if (type.includes('flood') || type.includes('fire') || type.includes('severe storm')) {
    return 'Medium';
  }
  
  return 'Low';
}

/**
 * Map FEMA incident type to category
 */
export function getFEMACategory(incidentType: string): 'Storm' | 'Flood' | 'Wildfire' | 'Earthquake' {
  const type = incidentType.toLowerCase();
  
  if (type.includes('flood')) return 'Flood';
  if (type.includes('fire')) return 'Wildfire';
  if (type.includes('earthquake')) return 'Earthquake';
  
  return 'Storm'; // Default to storm for hurricanes, tornadoes, severe storms, etc.
}
