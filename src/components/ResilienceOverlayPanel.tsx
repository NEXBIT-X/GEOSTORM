import React, { useState } from 'react';
import { Layers, Activity, Building2, AlertTriangle } from 'lucide-react';

interface Props {
  enabled: boolean;
  loading?: boolean;
  error?: string | null;
  data?: { hazards: number; infrastructure: number } | null;
  onToggle: (next: boolean) => void;
}

const ResilienceOverlayPanel: React.FC<Props> = ({ enabled, loading = false, error = null, data = null, onToggle }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative">
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 w-72 glass-panel p-3 space-y-3 border border-green-600/40">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              <div className="text-sm font-semibold text-green-300">Resilience Overlay</div>
            </div>
            
            <div className="text-[10px] text-gray-300 leading-relaxed">
              Live data showing infrastructure status and active hazard events from NASA EONET, FEMA, and OpenStreetMap.
            </div>

            {enabled && data && (
              <div className="space-y-2 pt-2 border-t border-gray-700">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Active Hazards</span>
                  </div>
                  <span className="font-semibold text-white">{data.hazards}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-green-400">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Infrastructure Sites</span>
                  </div>
                  <span className="font-semibold text-white">{data.infrastructure}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Legend</div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-500"></span>Operational</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-yellow-500"></span>Degraded</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-600"></span>Offline</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-orange-500"></span>Wildfire</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-blue-600"></span>Storm</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-sky-500"></span>Flood</div>
              </div>
            </div>
            
            {loading && (
              <div className="flex items-center gap-2 text-[10px] text-blue-400 animate-pulse">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Fetching live data from sources…</span>
              </div>
            )}
            {error && (
              <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => onToggle(!enabled)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all touch-manipulation shadow-lg ${
            enabled 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-600'
          }`}
          aria-pressed={enabled ? 'true' : 'false'}
          aria-label="Toggle resilience overlay"
        >
          <Layers className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Overlay</span>
        </button>
      </div>
    </div>
  );
};

export default ResilienceOverlayPanel;
