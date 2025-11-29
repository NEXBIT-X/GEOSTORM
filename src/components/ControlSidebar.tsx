import React from 'react';
import { Thermometer, AlertTriangle, Leaf } from 'lucide-react';

interface Props {
  selectedDataType: 'temperature' | 'disasters' | 'environmental';
  onDataTypeChange: (t: 'temperature' | 'disasters' | 'environmental') => void;
  onApiAction?: (action: 'openmeteo_current' | 'openmeteo_hourly' | 'openmeteo_daily') => void;
  onSearchLocation?: (query: string) => void;
  searching?: boolean;
  searchError?: string;
}

const ControlSidebar: React.FC<Props> = ({ selectedDataType, onDataTypeChange, onApiAction, onSearchLocation, searching = false, searchError }) => {
  const item = (key: Props['selectedDataType'], label: string, Icon: any) => (
    <button
      onClick={() => onDataTypeChange(key)}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition
        ${selectedDataType === key ? 'bg-blue-600 text-white' : 'bg-gray-700/60 text-gray-200 hover:bg-gray-700'}
        dark:${selectedDataType === key ? 'bg-blue-600 text-white' : 'bg-gray-800/70 text-gray-200 hover:bg-gray-800'}`}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  const [search, setSearch] = React.useState('');
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim() && onSearchLocation) onSearchLocation(search.trim());
  };

  return (
    <aside className="fixed left-4 top-4 z-50 w-56 space-y-3 p-3 glass-panel">
      <div className="flex items-center gap-2 mb-2">
        <img src="/Group 2.png" alt="GEOSTORM logo" className="h-6 w-6 rounded" />
        <div className="font-semibold text-sm text-white dark:text-gray-100">GEOSTORM</div>
      </div>
      <div className="section-title">Data Type</div>
      {item('temperature', 'Temperature', Thermometer)}
      {item('disasters', 'Disasters', AlertTriangle)}
      {item('environmental', 'Environmental', Leaf)}

      <div className="pt-2 mt-2 border-t border-gray-700 dark:border-gray-700" />
      <div className="section-title">Open‑Meteo APIs</div>
      <div className="space-y-2">
        <button onClick={() => onApiAction && onApiAction('openmeteo_current')} className="w-full px-3 py-2 text-sm glass-button">Current</button>
        <button onClick={() => onApiAction && onApiAction('openmeteo_hourly')} className="w-full px-3 py-2 text-sm glass-button">Hourly</button>
        <button onClick={() => onApiAction && onApiAction('openmeteo_daily')} className="w-full px-3 py-2 text-sm glass-button">Daily</button>
      </div>

      <div className="pt-2 mt-2 border-t border-gray-700 dark:border-gray-700" />
      <div className="section-title">Location Search</div>
      <form onSubmit={handleSearch} className="space-y-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="City or place"
          className="w-full px-2 py-2 rounded-md bg-gray-800/70 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="w-full px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        {searchError && <div className="text-[11px] text-red-400">{searchError}</div>}
      </form>

      
    </aside>
  );
};

export default ControlSidebar;