import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import GlobeMap from './GlobeMap';

interface MapContainerProps {
  dataType: 'temperature' | 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  onLocationSelect?: (location: any) => void;
  apiAction?: 'openmeteo_current' | 'openmeteo_hourly' | 'openmeteo_daily';
  onApiConsumed?: () => void;
  focusCoord?: { lat: number; lng: number; label?: string };
}

const MapContainer: React.FC<MapContainerProps> = ({
  dataType,
  climateData,
  disasters,
  environmentalData,
  apiAction,
  onApiConsumed,
  focusCoord,
}) => {
  return (
    <div className="absolute inset-0">
      <GlobeMap
        dataType={dataType}
        climateData={climateData}
        disasters={disasters}
        environmentalData={environmentalData}
        apiAction={apiAction}
        onApiConsumed={onApiConsumed}
        focusCoord={focusCoord}
      />
    </div>
  );
};

export default MapContainer;