export interface ClimateData {
  id: string;
  location: string;
  lat: number;
  lng: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  timestamp: string;
}

export interface DisasterEvent {
  id: string;
  type: string;
  location: string;
  lat: number;
  lng: number;
  severity: 'Low' | 'Medium' | 'High';
  timestamp: string;
  description: string;
}

export interface EnvironmentalData {
  id: string;
  location: string;
  lat: number;
  lng: number;
  airQuality: number;
  co2Level: number;
  pollutionIndex: number;
  timestamp: string;
}

// Public resilience / infrastructure research types
export interface InfrastructureSite {
  id: string;
  name: string;
  type: 'Hospital' | 'Power Plant' | 'Port' | 'Bridge' | 'Shelter';
  lat: number;
  lng: number;
  status: 'Operational' | 'Degraded' | 'Offline';
  lastUpdated: string;
}

export interface HazardEvent {
  id: string;
  title: string;
  category: 'Storm' | 'Flood' | 'Wildfire' | 'Earthquake';
  lat: number;
  lng: number;
  intensity: number; // scale 0-10
  detectedAt: string;
  source: string; // e.g. NOAA, NASA FIRMS (mocked)
}