import { useState, useEffect } from 'react';
import MapContainer from './components/MapContainer';
import ControlSidebar from './components/ControlSidebar';
import { ClimateData, DisasterEvent, EnvironmentalData } from './types';
import { climateAPI } from './services/api';

function App() {
  const [selectedDataType, setSelectedDataType] = useState<'temperature' | 'disasters' | 'environmental'>('temperature');
  const [climateData, setClimateData] = useState<ClimateData[]>([]);
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData[]>([]);
  const [apiAction, setApiAction] = useState<null | 'openmeteo_current' | 'openmeteo_hourly' | 'openmeteo_daily'>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusCoord, setFocusCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data and check API status
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [climateResult, disasterResult, environmentalResult] = await Promise.all([
          climateAPI.getClimateData({ limit: 50 }),
          climateAPI.getDisasters({ limit: 50 }),
          climateAPI.getEnvironmentalData({ limit: 50 })
        ]);

        setClimateData(climateResult);
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
        onApiAction={(a) => setApiAction(a)}
        onSearchLocation={async (query) => {
          setSearching(true);
          setSearchError(null);
          try {
            const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            if (!resp.ok) throw new Error('Request failed');
            const data = await resp.json();
            if (data && Array.isArray(data.results) && data.results.length) {
              const r = data.results[0];
              const lat = r.latitude;
              const lon = r.longitude;
              const label = [r.name, r.country].filter(Boolean).join(', ');
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
        searching={searching}
        searchError={searchError || undefined}
      />

      <div className="fixed inset-0 flex items-center justify-center">
        <MapContainer 
          dataType={selectedDataType}
          climateData={climateData}
          disasters={disasters}
          environmentalData={environmentalData}
          apiAction={apiAction || undefined}
          onApiConsumed={() => setApiAction(null)}
          focusCoord={focusCoord || undefined}
        />
      </div>

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