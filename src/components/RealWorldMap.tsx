import React, { useMemo } from 'react';
import { MapContainer as LeafMap, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';

interface RealWorldMapProps {
  dataType: 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  showConnections?: boolean;
  showHeatmap?: boolean;
}

const defaultCenter: LatLngExpression = [20, 0];

const getMarkerColor = (dataType: string, item: any) => {
  switch (dataType) {
    case 'temperature':
      if (item && item.temperature !== undefined) {
        if (item.temperature < 0) return '#3b82f6';
        if (item.temperature < 10) return '#06b6d4';
        if (item.temperature < 20) return '#10b981';
        if (item.temperature < 30) return '#f59e0b';
        return '#ef4444';
      }
      return '#ef4444';
    case 'disasters':
      if (item && item.severity) {
        if (item.severity === 'High') return '#dc2626';
        if (item.severity === 'Medium') return '#f59e0b';
        return '#fbbf24';
      }
      return '#f59e0b';
    case 'environmental':
      if (item && item.airQuality !== undefined) {
        if (item.airQuality <= 50) return '#10b981';
        if (item.airQuality <= 100) return '#f59e0b';
        if (item.airQuality <= 150) return '#f97316';
        if (item.airQuality <= 200) return '#ef4444';
        return '#7c2d12';
      }
      return '#10b981';
    default:
      return '#3b82f6';
  }
};

const useFitBoundsToData = (allPoints: [number, number][]) => {
  const map = useMap();
  if (!map) return null;
  if (allPoints.length === 0) return null;
  try {
    map.fitBounds(allPoints as LatLngExpression[], { padding: [50, 50], maxZoom: 5 });
  } catch (e) {
    // ignore
  }
  return null;
};

const RealWorldMap: React.FC<RealWorldMapProps> = ({ dataType, climateData, disasters, environmentalData, showConnections = true, showHeatmap = true }) => {
  const data = useMemo(() => {
    switch (dataType) {
      case 'temperature': return climateData;
      case 'disasters': return disasters;
      case 'environmental': return environmentalData;
      default: return [];
    }
  }, [dataType, climateData, disasters, environmentalData]);

  const points = useMemo(() => data
    .filter((d: any) => d.lat !== undefined && d.lng !== undefined)
    .map((d: any) => [d.lat, d.lng] as [number, number]), [data]
  );

  // Use a canvas renderer for large numbers of markers to improve performance
  const canvasRenderer = useMemo(() => L.canvas({ padding: 1 }), []);

  return (
    <div className="absolute inset-0 z-0">
      <LeafMap center={defaultCenter} zoom={2} className="w-full h-full">
        {/* Use Esri World Imagery (satellite) tiles as the default base layer */}
        <TileLayer
          attribution='&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

      {/* Fit map to data bounds */}
      {points.length > 0 && <FitToBounds allPoints={points} />}

      {/* Simple heat-like CircleMarkers */}
      {showHeatmap && data.map((item: any, idx: number) => {
        if (item.lat === undefined || item.lng === undefined) return null;
        const intensity = dataType === 'temperature' ? Math.min(1, Math.abs(item.temperature ?? 0) / 50)
          : dataType === 'disasters' ? (item.severity === 'High' ? 1 : item.severity === 'Medium' ? 0.6 : 0.3)
          : Math.min(1, (item.airQuality ?? 0) / 200);
        // For very large datasets, reduce marker radius for performance
        const largeCount = data.length > 2000;
        const radius = largeCount ? Math.max(2, 3 + intensity * 3) : 6 + intensity * 18;
        const color = getMarkerColor(dataType, item);

        return (
          <CircleMarker
            key={idx}
            center={[item.lat, item.lng]}
            radius={radius}
            renderer={canvasRenderer}
            pathOptions={{ color, fillColor: color, fillOpacity: largeCount ? 0.25 : 0.35, weight: 1 }}
          >
            {/* For extremely large sets we skip popups to keep rendering fast */}
            {!largeCount && (
              <Popup>
                <div className="min-w-[160px]">
                  <div className="font-bold">{item.location ?? item.type ?? 'Location'}</div>
                  <div className="mt-1">
                    {dataType === 'temperature' && <div>{item.temperature}°C • {item.humidity}%</div>}
                    {dataType === 'disasters' && <div>{item.type} • {item.severity}</div>}
                    {dataType === 'environmental' && <div>AQI {item.airQuality} • CO2 {item.co2Level}ppm</div>}
                  </div>
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}

      {/* Connections */}
      {showConnections && data.map((item: any, i: number) => {
        if (item.lat === undefined || item.lng === undefined) return null;
        const lines: [number, number][][] = [];
        for (let j = i + 1; j < data.length; j++) {
          const other = data[j];
          if (other.lat === undefined || other.lng === undefined) continue;
          const dist = haversineDistance(item.lat, item.lng, other.lat, other.lng);
          if (dist < 3000) {
            lines.push([[item.lat, item.lng], [other.lat, other.lng]]);
          }
        }
        return lines.map((coords, idx) => (
          <Polyline key={`line-${i}-${idx}`} positions={coords} pathOptions={{ color: '#ffffff66', dashArray: '6', weight: 1.5 }} />
        ));
      })}

    </LeafMap>
    </div>
  );
};

const FitToBounds: React.FC<{ allPoints: [number, number][] }> = ({ allPoints }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!map || allPoints.length === 0) return;
    try {
      map.fitBounds(allPoints as LatLngExpression[], { padding: [50, 50], maxZoom: 5 });
    } catch (e) {
      // ignore fit errors
    }
  }, [map, allPoints]);
  return null;
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default RealWorldMap;
