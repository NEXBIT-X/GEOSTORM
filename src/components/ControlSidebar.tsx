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

const ControlSidebar: React.FC<Props> = ({ 
  selectedDataType, 
  onDataTypeChange, 
  onSearchLocation, 
  onSelectLocation, 
  onIndiaLocationSelect,
  searching = false, 
  searchError 
}) => {
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
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg glass-panel"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 z-50 w-72 sm:w-80 lg:left-4 lg:top-4 lg:bottom-auto lg:w-56 space-y-3 p-3 glass-panel transition-transform duration-300 overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 mb-2">
          <img src="/Group 2.png" alt="GEOSTORM logo" className="h-6 w-6 rounded" />
          <div className="font-semibold text-sm text-white dark:text-gray-100">GEOSTORM</div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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

      {/* India Location Selector */}
      <div className="pt-2 mt-2 border-t border-gray-700 dark:border-gray-700" />
      <div className="bg-gradient-to-r from-orange-500/10 to-green-500/10 rounded-lg border border-orange-500/30 overflow-hidden">
        <button
          onClick={() => setShowIndiaSelector(!showIndiaSelector)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-white">🇮🇳 India</span>
          </div>
          {showIndiaSelector ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        
        {showIndiaSelector && (
          <div className="p-3 space-y-2 bg-gray-900/30">
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Select Indian State"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-gray-800 text-white">Select State...</option>
              {INDIAN_STATES.map(state => (
                <option key={state.code} value={state.name} className="bg-gray-800 text-white">
                  {state.name}
                </option>
              ))}
            </select>

            {selectedState && districts.length > 0 && (
              <select
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                aria-label="Select District"
                style={{ colorScheme: 'dark' }}
              >
                <option value="" className="bg-gray-800 text-white">Select District...</option>
                {districts.map(district => (
                  <option key={district} value={district} className="bg-gray-800 text-white">
                    {district}
                  </option>
                ))}
              </select>
            )}

            {selectedState && selectedDistrict && (
              <div className="bg-green-500/20 border border-green-500/40 rounded-md p-2">
                <div className="flex items-center space-x-1.5 text-green-400">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs font-medium">Selected</span>
                </div>
                <p className="text-white text-xs mt-0.5">
                  {selectedDistrict}, {selectedState}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </aside>
    </>
  );
};

export default ControlSidebar;