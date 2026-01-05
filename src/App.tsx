import { useState, useEffect } from 'react';
import MapContainer from './components/MapContainer';
import ControlSidebar from './components/ControlSidebar';
import ResilienceOverlayPanel from './components/ResilienceOverlayPanel';
import { ClimateData, DisasterEvent, EnvironmentalData } from './types';
import { climateAPI } from './services/api';
import { searchIndianLocations, fetchIMDWeather, IMDWeatherData } from './services/indiaWeather';

function App() {
  const [selectedDataType, setSelectedDataType] = useState<'disasters' | 'environmental'>('disasters');
  const [climateData, setClimateData] = useState<ClimateData[]>([]); // climate data disabled; app focuses on disasters + environmental
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData[]>([]);
  // Open‑Meteo actions removed
  const [isLoading, setIsLoading] = useState(true);
  const [focusCoord, setFocusCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [districtWeather, setDistrictWeather] = useState<IMDWeatherData | null>(null);
  const [districtWeatherLoading, setDistrictWeatherLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [infraHazardsEnabled, setInfraHazardsEnabled] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [overlayData, setOverlayData] = useState<{ hazards: number; infrastructure: number } | null>(null);

  // Fetch overlay data when enabled
  useEffect(() => {
    if (!infraHazardsEnabled) {
      setOverlayData(null);
      setOverlayError(null);
      return;
    }
    
    let mounted = true;
    const loadOverlayData = async () => {
      setOverlayLoading(true);
      setOverlayError(null);
      try {
        const { fetchLiveOverlay } = await import('./services/hazards');
        const data = await fetchLiveOverlay();
        if (mounted) {
          const hazards = data.filter(d => d.kind === 'hazard').length;
          const infrastructure = data.filter(d => d.kind === 'infrastructure').length;
          setOverlayData({ hazards, infrastructure });
        }
      } catch (error: any) {
        if (mounted) {
          setOverlayError('Failed to load overlay data');
        }
      } finally {
        if (mounted) setOverlayLoading(false);
      }
    };
    
    loadOverlayData();
    return () => { mounted = false; };
  }, [infraHazardsEnabled]);

  useEffect(() => {
    // Load initial data and check API status
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [disasterResult, environmentalResult] = await Promise.all([
          climateAPI.getDisasters({ limit: 50 }),
          climateAPI.getEnvironmentalData({ limit: 50 })
        ]);

        // climate data intentionally not fetched; keep empty
        setDisasters(disasterResult);
        setEnvironmentalData(environmentalResult);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Seed database if no data exists
  useEffect(() => {
    if (!isLoading && climateData.length === 0 && disasters.length === 0 && environmentalData.length === 0) {
      const seedData = async () => {
        console.log('No data found, seeding database...');
        const success = await climateAPI.seedDatabase();
        if (success) {
          // Reload data after seeding
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      };
      seedData();
    }
  }, [isLoading, climateData.length, disasters.length, environmentalData.length]);
  return (
    <div className="w-screen h-screen bg-gray-900 text-white overflow-hidden m-0 p-0">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading climate data...</p>
            <p className="text-gray-400 text-sm mt-2">Connecting to real-time API</p>
          </div>
        </div>
      )}

      {/* Award banner removed */}

      {/* Sidebar controls */}
      <ControlSidebar
        selectedDataType={selectedDataType}
        onDataTypeChange={setSelectedDataType}
        onSearchLocation={async (query) => {
          setSearching(true);
          setSearchError(null);
          try {
            // First try Indian locations
            const indianResults = searchIndianLocations(query);
            if (indianResults.length > 0) {
              const first = indianResults[0];
              setFocusCoord({ 
                lat: first.coords.lat, 
                lng: first.coords.lng, 
                label: `${first.district}, ${first.state}` 
              });
              setSearching(false);
              return;
            }
            // Fallback to Nominatim (OpenStreetMap) for global geocoding
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`, { headers: { 'User-Agent': 'GEOSTORM/1.0 (contact@yourdomain.example)' } });
            if (!resp.ok) throw new Error('Request failed');
            const results = await resp.json();
            if (Array.isArray(results) && results.length) {
              const r = results[0];
              const lat = Number(r.lat);
              const lon = Number(r.lon);
              const label = (r.display_name || '').split(',')[0] || r.display_name;
              setFocusCoord({ lat, lng: lon, label });
            } else {
              setSearchError('No results found');
            }
          } catch (e: any) {
            setSearchError('Search failed');
          } finally {
            setSearching(false);
          }
        }}
        onSelectLocation={(coord) => {
          setFocusCoord(coord);
        }}
        onIndiaLocationSelect={async (state, district, coords) => {
          // Focus the map on the selected district
          setFocusCoord({
            lat: coords.lat,
            lng: coords.lng,
            label: `${district}, ${state}`
          });

          // Fetch district weather (IMD / API Setu placeholder)
          try {
            setDistrictWeatherLoading(true);
            const data = await fetchIMDWeather(state, district);
            if (data && data.length > 0) {
              setDistrictWeather(data[0]);
            } else {
              setDistrictWeather(null);
            }
          } catch (e) {
            console.error('Failed to fetch district weather', e);
            setDistrictWeather(null);
          } finally {
            setDistrictWeatherLoading(false);
          }
        }}
        searching={searching}
        searchError={searchError || undefined}
      />

      <div className="fixed inset-0 flex items-center justify-center">
        <MapContainer 
          dataType={selectedDataType}
          climateData={climateData}
          disasters={disasters}
          environmentalData={environmentalData}
          focusCoord={focusCoord || undefined}
          infraHazardsEnabled={infraHazardsEnabled}
        />
      </div>

      <ResilienceOverlayPanel 
        enabled={infraHazardsEnabled} 
        onToggle={setInfraHazardsEnabled}
        loading={overlayLoading}
        error={overlayError}
        data={overlayData}
      />

      {/* API Status indicator (hidden) */}
      {/* Removed display of "Mock Data" badge to keep UI clean per requirements */}

      {/* Google Maps attribution removed from visible UI */}

      {/* Footer removed for full-screen experience */}
      {/* Award badge bottom-right */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="px-4 py-2 rounded-md bg-blue-600/20 border border-blue-500 text-[11px] font-semibold uppercase tracking-wide text-blue-200 backdrop-blur-sm shadow-lg">
          Google Maps Platform Winner
        </div>
      </div>
    </div>
  );
}

export default App;