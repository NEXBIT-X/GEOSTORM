// India Meteorological Department (IMD) API via API Setu
// Documentation: https://directory.apisetu.gov.in/api-collection/mausam

export interface IndianState {
  code: string;
  name: string;
  districts: string[];
}

export interface IndianDistrict {
  state: string;
  name: string;
  lat: number;
  lng: number;
}

export interface IMDWeatherData {
  location: string;
  state: string;
  district: string;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  windSpeed?: number;
  pressure?: number;
  description?: string;
  timestamp: string;
}

// Indian States and major districts with approximate coordinates
export const INDIAN_STATES: IndianState[] = [
  { code: 'AP', name: 'Andhra Pradesh', districts: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Kakinada'] },
  { code: 'AR', name: 'Arunachal Pradesh', districts: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'] },
  { code: 'AS', name: 'Assam', districts: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur'] },
  { code: 'BR', name: 'Bihar', districts: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'] },
  { code: 'CT', name: 'Chhattisgarh', districts: ['Raipur', 'Bilaspur', 'Durg', 'Korba', 'Rajnandgaon'] },
  { code: 'GA', name: 'Goa', districts: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
  { code: 'GJ', name: 'Gujarat', districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'] },
  { code: 'HR', name: 'Haryana', districts: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'] },
  { code: 'HP', name: 'Himachal Pradesh', districts: ['Shimla', 'Dharamshala', 'Manali', 'Kullu', 'Solan'] },
  { code: 'JH', name: 'Jharkhand', districts: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'] },
  { code: 'KA', name: 'Karnataka', districts: ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum'] },
  { code: 'KL', name: 'Kerala', districts: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'] },
  { code: 'MP', name: 'Madhya Pradesh', districts: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'] },
  { code: 'MH', name: 'Maharashtra', districts: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'] },
  { code: 'MN', name: 'Manipur', districts: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'] },
  { code: 'ML', name: 'Meghalaya', districts: ['Shillong', 'Tura', 'Jowai', 'Nongstoin'] },
  { code: 'MZ', name: 'Mizoram', districts: ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip'] },
  { code: 'NL', name: 'Nagaland', districts: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'] },
  { code: 'OR', name: 'Odisha', districts: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Berhampur'] },
  { code: 'PB', name: 'Punjab', districts: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'] },
  { code: 'RJ', name: 'Rajasthan', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'] },
  { code: 'SK', name: 'Sikkim', districts: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'] },
  { code: 'TN', name: 'Tamil Nadu', districts: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'] },
  { code: 'TG', name: 'Telangana', districts: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar'] },
  { code: 'TR', name: 'Tripura', districts: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar'] },
  { code: 'UP', name: 'Uttar Pradesh', districts: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut'] },
  { code: 'UT', name: 'Uttarakhand', districts: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Nainital'] },
  { code: 'WB', name: 'West Bengal', districts: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'] },
  { code: 'DL', name: 'Delhi', districts: ['New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi'] },
  { code: 'PY', name: 'Puducherry', districts: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'] },
  { code: 'CH', name: 'Chandigarh', districts: ['Chandigarh'] },
  { code: 'JK', name: 'Jammu and Kashmir', districts: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'] },
  { code: 'LA', name: 'Ladakh', districts: ['Leh', 'Kargil'] },
];

// District coordinates (approximate centers)
export const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  // Andhra Pradesh
  'Visakhapatnam': { lat: 17.6869, lng: 83.2185 },
  'Vijayawada': { lat: 16.5062, lng: 80.6480 },
  'Guntur': { lat: 16.3067, lng: 80.4365 },
  'Tirupati': { lat: 13.6288, lng: 79.4192 },
  'Kakinada': { lat: 16.9891, lng: 82.2475 },
  
  // Karnataka
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Mysore': { lat: 12.2958, lng: 76.6394 },
  'Hubli': { lat: 15.3647, lng: 75.1240 },
  'Mangalore': { lat: 12.9141, lng: 74.8560 },
  'Belgaum': { lat: 15.8497, lng: 74.4977 },
  
  // Maharashtra
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Nagpur': { lat: 21.1458, lng: 79.0882 },
  'Nashik': { lat: 19.9975, lng: 73.7898 },
  'Aurangabad': { lat: 19.8762, lng: 75.3433 },
  
  // Tamil Nadu
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Coimbatore': { lat: 11.0168, lng: 76.9558 },
  'Madurai': { lat: 9.9252, lng: 78.1198 },
  'Tiruchirappalli': { lat: 10.7905, lng: 78.7047 },
  'Salem': { lat: 11.6643, lng: 78.1460 },
  
  // Telangana
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Warangal': { lat: 17.9689, lng: 79.5941 },
  'Nizamabad': { lat: 18.6725, lng: 78.0941 },
  'Khammam': { lat: 17.2473, lng: 80.1514 },
  'Karimnagar': { lat: 18.4386, lng: 79.1288 },
  
  // West Bengal
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Howrah': { lat: 22.5958, lng: 88.2636 },
  'Durgapur': { lat: 23.5204, lng: 87.3119 },
  'Asansol': { lat: 23.6739, lng: 86.9524 },
  'Siliguri': { lat: 26.7271, lng: 88.3953 },
  
  // Delhi
  'New Delhi': { lat: 28.6139, lng: 77.2090 },
  'Central Delhi': { lat: 28.6692, lng: 77.2273 },
  'North Delhi': { lat: 28.7041, lng: 77.1025 },
  'South Delhi': { lat: 28.5244, lng: 77.1855 },
  
  // Gujarat
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Surat': { lat: 21.1702, lng: 72.8311 },
  'Vadodara': { lat: 22.3072, lng: 73.1812 },
  'Rajkot': { lat: 22.3039, lng: 70.8022 },
  'Bhavnagar': { lat: 21.7645, lng: 72.1519 },
  
  // Rajasthan
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Jodhpur': { lat: 26.2389, lng: 73.0243 },
  'Udaipur': { lat: 24.5854, lng: 73.7125 },
  'Kota': { lat: 25.2138, lng: 75.8648 },
  'Ajmer': { lat: 26.4499, lng: 74.6399 },
  
  // Kerala
  'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'Kochi': { lat: 9.9312, lng: 76.2673 },
  'Kozhikode': { lat: 11.2588, lng: 75.7804 },
  'Thrissur': { lat: 10.5276, lng: 76.2144 },
  'Kollam': { lat: 8.8932, lng: 76.6141 },
  
  // Uttar Pradesh
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
  'Kanpur': { lat: 26.4499, lng: 80.3319 },
  'Agra': { lat: 27.1767, lng: 78.0081 },
  'Varanasi': { lat: 25.3176, lng: 82.9739 },
  'Meerut': { lat: 28.9845, lng: 77.7064 },
  
  // Madhya Pradesh
  'Bhopal': { lat: 23.2599, lng: 77.4126 },
  'Indore': { lat: 22.7196, lng: 75.8577 },
  'Gwalior': { lat: 26.2183, lng: 78.1828 },
  'Jabalpur': { lat: 23.1815, lng: 79.9864 },
  'Ujjain': { lat: 23.1765, lng: 75.7885 },
  
  // Bihar
  'Patna': { lat: 25.5941, lng: 85.1376 },
  'Gaya': { lat: 24.7955, lng: 84.9994 },
  'Bhagalpur': { lat: 25.2425, lng: 86.9842 },
  'Muzaffarpur': { lat: 26.1225, lng: 85.3906 },
  'Darbhanga': { lat: 26.1542, lng: 85.8918 },
  
  // Punjab
  'Ludhiana': { lat: 30.9010, lng: 75.8573 },
  'Amritsar': { lat: 31.6340, lng: 74.8723 },
  'Jalandhar': { lat: 31.3260, lng: 75.5762 },
  'Patiala': { lat: 30.3398, lng: 76.3869 },
  'Bathinda': { lat: 30.2110, lng: 74.9455 },
  
  // Add more major districts as needed
  'Chandigarh': { lat: 30.7333, lng: 76.7794 },
  'Puducherry': { lat: 11.9416, lng: 79.8083 },
  'Srinagar': { lat: 34.0837, lng: 74.7973 },
  'Jammu': { lat: 32.7266, lng: 74.8570 },
  'Leh': { lat: 34.1526, lng: 77.5771 },
  'Guwahati': { lat: 26.1445, lng: 91.7362 },
  'Itanagar': { lat: 27.0844, lng: 93.6053 },
  'Imphal': { lat: 24.8170, lng: 93.9368 },
  'Shillong': { lat: 25.5788, lng: 91.8933 },
  'Aizawl': { lat: 23.7271, lng: 92.7176 },
  'Kohima': { lat: 25.6747, lng: 94.1086 },
  'Agartala': { lat: 23.8315, lng: 91.2868 },
  'Gangtok': { lat: 27.3389, lng: 88.6065 },
  'Bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'Raipur': { lat: 21.2514, lng: 81.6296 },
  'Ranchi': { lat: 23.3441, lng: 85.3096 },
  'Dehradun': { lat: 30.3165, lng: 78.0322 },
  'Shimla': { lat: 31.1048, lng: 77.1734 },
  'Panaji': { lat: 15.4909, lng: 73.8278 },
};

/**
 * Fetch weather data for Indian states/districts
 * Note: The API Setu Mausam API may require authentication
 * For production, you'll need to register and get API credentials
 */
export async function fetchIMDWeather(state?: string, district?: string): Promise<IMDWeatherData[]> {
  try {
    // Note: This is a placeholder implementation
    // The actual API endpoint structure may differ based on API Setu documentation
    // You may need to register at https://apisetu.gov.in/ for API access
    
    const results: IMDWeatherData[] = [];
    const now = new Date().toISOString();
    
    // For demonstration, generate mock data for Indian locations
    // In production, replace this with actual API calls
    
    const locationsToFetch = [];
    
    if (state && district) {
      // Specific district
      locationsToFetch.push({ state, district });
    } else if (state) {
      // All districts in state
      const stateData = INDIAN_STATES.find(s => s.name === state || s.code === state);
      if (stateData) {
        stateData.districts.forEach(dist => {
          locationsToFetch.push({ state: stateData.name, district: dist });
        });
      }
    } else {
      // Major cities from all states
      INDIAN_STATES.forEach(stateData => {
        if (stateData.districts.length > 0) {
          locationsToFetch.push({ state: stateData.name, district: stateData.districts[0] });
        }
      });
    }
    
    for (const loc of locationsToFetch.slice(0, 50)) { // Limit to prevent overload
      const coords = DISTRICT_COORDS[loc.district];
      if (!coords) continue;
      
      // Generate realistic weather data for Indian climate
      const baseTemp = 25 + Math.random() * 15; // 25-40°C typical range
      const humidity = 40 + Math.random() * 50; // 40-90% humidity
      
      results.push({
        location: `${loc.district}, ${loc.state}`,
        state: loc.state,
        district: loc.district,
        temperature: parseFloat(baseTemp.toFixed(1)),
        humidity: parseFloat(humidity.toFixed(1)),
        rainfall: Math.random() > 0.7 ? parseFloat((Math.random() * 50).toFixed(1)) : 0,
        windSpeed: parseFloat((5 + Math.random() * 20).toFixed(1)),
        pressure: parseFloat((1010 + Math.random() * 20).toFixed(1)),
        description: humidity > 70 ? 'Humid' : humidity > 50 ? 'Partly Cloudy' : 'Clear',
        timestamp: now
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('Error fetching IMD weather:', error);
    return [];
  }
}

/**
 * Convert IMD weather data to ClimateData format
 */
export function imdToClimateData(imdData: IMDWeatherData[]): any[] {
  return imdData.map((data, idx) => {
    const coords = DISTRICT_COORDS[data.district];
    return {
      id: `imd-${idx}`,
      location: data.location,
      lat: coords?.lat || 0,
      lng: coords?.lng || 0,
      temperature: data.temperature || 0,
      humidity: data.humidity || 0,
      windSpeed: data.windSpeed || 0,
      timestamp: data.timestamp
    };
  });
}

/**
 * Get all districts for a given state
 */
export function getDistrictsByState(stateName: string): string[] {
  const state = INDIAN_STATES.find(s => s.name === stateName || s.code === stateName);
  return state ? state.districts : [];
}

/**
 * Search Indian locations by query
 */
export function searchIndianLocations(query: string): Array<{ state: string; district: string; coords: { lat: number; lng: number } }> {
  const results: Array<{ state: string; district: string; coords: { lat: number; lng: number } }> = [];
  const lowerQuery = query.toLowerCase();
  
  INDIAN_STATES.forEach(state => {
    state.districts.forEach(district => {
      if (district.toLowerCase().includes(lowerQuery) || state.name.toLowerCase().includes(lowerQuery)) {
        const coords = DISTRICT_COORDS[district];
        if (coords) {
          results.push({
            state: state.name,
            district,
            coords
          });
        }
      }
    });
  });
  
  return results.slice(0, 10); // Limit to top 10 results
}
