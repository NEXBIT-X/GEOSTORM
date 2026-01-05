import React from 'react';
import { AlertTriangle, Leaf, Globe, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { INDIAN_STATES, getDistrictsByState, DISTRICT_COORDS } from '../services/indiaWeather';

interface Props {
  selectedDataType: 'disasters' | 'environmental';
  onDataTypeChange: (t: 'disasters' | 'environmental') => void;
  onSearchLocation?: (query: string) => void;
  onSelectLocation?: (coord: { lat: number; lng: number; label?: string }) => void;
  onIndiaLocationSelect?: (state: string, district: string, coords: { lat: number; lng: number }) => void;
  searching?: boolean;
  searchError?: string;
}

const ControlSidebar: React.FC<Props> = ({ selectedDataType, onDataTypeChange, onApiAction, onSearchLocation, searching = false, searchError }) => {
  const item = (key: Props['selectedDataType'], label: string, Icon: any) => (
    <button
      onClick={() => onDataTypeChange(key)}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition
        ${selectedDataType === key ? 'bg-blue-600 text-white' : 'bg-gray-700/60 text-gray-200 hover:bg-gray-700'}`}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  const [search, setSearch] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Array<{ name: string; country?: string; lat: number; lon: number }>>([]);
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const [showIndiaSelector, setShowIndiaSelector] = React.useState(false);
  const [selectedState, setSelectedState] = React.useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = React.useState<string>('');

  const districts = selectedState ? getDistrictsByState(selectedState) : [];

  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedDistrict('');
    
    // Automatically fetch weather for the state's first major district
    if (stateName && onIndiaLocationSelect) {
      const stateData = INDIAN_STATES.find(s => s.name === stateName);
      if (stateData && stateData.districts.length > 0) {
        const firstDistrict = stateData.districts[0];
        const coords = DISTRICT_COORDS[firstDistrict];
        if (coords) {
          // Automatically set the district to show it's selected
          setSelectedDistrict(firstDistrict);
          onIndiaLocationSelect(stateName, firstDistrict, coords);
        }
      }
    }
  };

  const handleDistrictChange = (districtName: string) => {
    setSelectedDistrict(districtName);
    if (selectedState && districtName && onIndiaLocationSelect) {
      const coords = DISTRICT_COORDS[districtName];
      if (coords) {
        onIndiaLocationSelect(selectedState, districtName, coords);
      }
    }
  };

  // Debounced geocoding suggestions with India priority
  React.useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      const q = search.trim();
      if (!q) { setSuggestions([]); setActiveIndex(-1); return; }
      setSuggestLoading(true);
      try {
        // First, try Indian locations
        const { searchIndianLocations } = await import('../services/indiaWeather');
        const indianResults = searchIndianLocations(q);
        
        if (indianResults.length > 0) {
          const mapped = indianResults.map(r => ({
            name: r.district,
            country: r.state + ', India',
            lat: r.coords.lat,
            lon: r.coords.lng
          }));
          setSuggestions(mapped);
          setActiveIndex(0);
          setSuggestLoading(false);
          return;
        }
        
        // Fallback to global search using Nominatim (OpenStreetMap)
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`, { signal: ctrl.signal, headers: { 'User-Agent': 'GEOSTORM/1.0 (contact@yourdomain.example)' } });
        if (!resp.ok) throw new Error('Suggest failed');
        const data = await resp.json();
        const results = Array.isArray(data) ? data : [];
        const mapped = results.map((r: any) => ({
          name: (r.display_name || '').split(',')[0] || r.display_name || r.type || 'Place',
          country: (r.address && (r.address.country || r.address.state)) ? ((r.address.country) ? r.address.country : r.address.state) : '',
          lat: Number(r.lat),
          lon: Number(r.lon)
        }));
        setSuggestions(mapped);
        setActiveIndex(mapped.length ? 0 : -1);
      } catch { if (!ctrl.signal.aborted) { setSuggestions([]); setActiveIndex(-1); } }
      finally { setSuggestLoading(false); }
    };
    const t = setTimeout(run, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim() && onSearchLocation) onSearchLocation(search.trim());
  };

  const chooseSuggestion = (s: { name: string; country?: string; lat: number; lon: number }) => {
    const label = [s.name, s.country].filter(Boolean).join(', ');
    onSelectLocation && onSelectLocation({ lat: s.lat, lng: s.lon, label });
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); chooseSuggestion(suggestions[activeIndex]); }
  };

  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <aside className="fixed left-4 top-4 z-50 w-56 space-y-3 p-3 glass-panel">
      <div className="flex items-center gap-2 mb-2">
        <img src="/Group 2.png" alt="GEOSTORM logo" className="h-6 w-6 rounded" />
        <div className="font-semibold text-sm text-white dark:text-gray-100">GEOSTORM</div>
      </div>
      <div className="section-title">Data Type</div>
      {item('disasters', 'Disasters', AlertTriangle)}
      {item('environmental', 'Environmental', Leaf)}

      <div className="pt-2 mt-2 border-t border-gray-700 dark:border-gray-700" />
      <div className="section-title">Location Search</div>
      <form onSubmit={handleSearch} className="space-y-2 relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="City or place"
          className="w-full px-2 py-2 rounded-md bg-gray-800/70 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Suggestion dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[44px] z-50 bg-gray-900 backdrop-blur-md border border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, idx) => (
              <button
                type="button"
                key={`${s.name}-${s.lat}-${s.lon}`}
                className={`w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors ${idx === activeIndex ? 'bg-gray-800' : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => chooseSuggestion(s)}
              >
                <div className="flex justify-between">
                  <span className="text-gray-100">{s.name}</span>
                  <span className="text-gray-400">{s.country}</span>
                </div>
                <div className="text-[10px] text-gray-500">{s.lat.toFixed(3)}, {s.lon.toFixed(3)}</div>
              </button>
            ))}
            {suggestLoading && <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>}
          </div>
        )}
        <button type="submit" className="w-full px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        {searchError && <div className="text-[11px] text-red-400">{searchError}</div>}
      </form>

      
    </aside>
    </>
  );
};

export default ControlSidebar;