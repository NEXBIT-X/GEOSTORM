import { ClimateData, DisasterEvent, EnvironmentalData } from '../types';
import GlobeMap from './GlobeMap';
import CesiumMap from './CesiumMap';

interface MapContainerProps {
  dataType: 'disasters' | 'environmental';
  climateData: ClimateData[];
  disasters: DisasterEvent[];
  environmentalData: EnvironmentalData[];
  onLocationSelect?: (location: any) => void;
  focusCoord?: { lat: number; lng: number; label?: string };
  infraHazardsEnabled?: boolean;
  useCesium?: boolean;
  tilesetUrl?: string;
}

const MapContainer: React.FC<MapContainerProps> = ({
  dataType,
  climateData,
  disasters,
  environmentalData,
  focusCoord,
  infraHazardsEnabled,
  useCesium = false,
  tilesetUrl
}) => {
  return (
    <div className="absolute inset-0">
      {useCesium ? (
        <CesiumMap
          dataType={dataType}
          climateData={climateData}
          disasters={disasters}
          environmentalData={environmentalData}
          focusCoord={focusCoord}
          tilesetUrl={tilesetUrl}
        />
      ) : (
        <GlobeMap
          dataType={dataType}
          climateData={climateData}
          disasters={disasters}
          environmentalData={environmentalData}
          focusCoord={focusCoord}
          infraHazardsEnabled={infraHazardsEnabled}
        />
      )}
    </div>
  );
};

export default MapContainer;