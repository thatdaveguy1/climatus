import { Model, Metric, Location } from './types';

export const DEFAULT_LOCATION: Location = {
  id: 6137331,
  name: 'St. Albert',
  latitude: 53.63,
  longitude: -113.63,
  country: 'Canada',
  admin1: 'Alberta',
};

export const ACCURACY_LOCATIONS: Location[] = [
  {
    id: 1,
    name: '37 Jubilation',
    latitude: 53.66435844967257,
    longitude: -113.64584647888562,
    country: 'Canada',
    admin1: 'Alberta',
  },
  {
    id: 2,
    name: '66 Aspenglen Cres',
    latitude: 53.5602078582863,
    longitude: -113.910951582919,
    country: 'Canada',
    admin1: 'Alberta',
  },
  {
    id: 3,
    name: 'Edmonton Airport CYEG',
    latitude: 53.314143603363405,
    longitude: -113.58986567205196,
    country: 'Canada',
    admin1: 'Alberta',
  },
  {
    id: 4,
    name: 'Villeneuve Airport CZVL',
    latitude: 53.67007644383797,
    longitude: -113.8631353717015,
    country: 'Canada',
    admin1: 'Alberta',
  }
];

export const isUSMainland = (lat: number, lon: number): boolean =>
  lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;

export const LAST_ACCURACY_CHECK_KEY = 'lastAccuracyCheckTimestamp';
export const ACCURACY_FIRST_RUN_KEY = 'accuracyFirstRunTimestamp';
export const ACCURACY_MAX_FORECAST_HOURS = 120; // 5 days
export const ACCURACY_STALE_FORECAST_HOURS = 336; // 14 days, matching data retention


// Base parameter sets for models on the main forecast endpoint.
const PARAMS_FULL = ['temperature_2m', 'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'cloud_cover', 'visibility'];
const PARAMS_NO_VISIBILITY = ['temperature_2m', 'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'cloud_cover'];
const PARAMS_WITH_VISIBILITY = [...PARAMS_NO_VISIBILITY, 'visibility'];
const PARAMS_NO_GUSTS_VISIBILITY = ['temperature_2m', 'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover'];
const PARAMS_LIMITED = ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m'];
const PARAMS_BOM_ACCESS_G2 = ['temperature_2m', 'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover'];

// --- Model-Specific Parameter Sets to fix API errors ---

// GEM and ECMWF endpoints require concatenated parameter names (e.g., 'windspeed_10m').
const PARAMS_HRDPS_RDPS = ['temperature_2m', 'rain', 'snowfall', 'windspeed_10m', 'winddirection_10m', 'windgusts_10m', 'cloudcover'];
const PARAMS_AIFS = ['temperature_2m', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'windgusts_10m', 'cloud_cover'];
const PARAMS_ECMWF_IFS = ['temperature_2m', 'precipitation', 'rain', 'snowfall', 'windspeed_10m', 'winddirection_10m', 'windgusts_10m', 'cloudcover'];


export const MODELS: Model[] = [
  // FORECAST ENDPOINT
  { key: 'icon_global', name: 'ICON Global 7km', apiName: 'icon_global', endpoint: 'forecast', category: 'Global', params: PARAMS_WITH_VISIBILITY, enabled: true },
  { key: 'jma_gsm', name: 'JMA GSM 20km', apiName: 'jma_gsm', endpoint: 'forecast', category: 'Global', params: PARAMS_NO_VISIBILITY, enabled: true },
  { key: 'cma_grapes_global', name: 'CMA Grapes 12km', apiName: 'cma_grapes_global', endpoint: 'forecast', category: 'Global', params: PARAMS_NO_VISIBILITY, enabled: true },
  
  // DEDICATED DOMAIN ENDPOINTS
  { key: 'arpege_world', name: 'ARPEGE World 11km', apiName: 'arpege-world', endpoint: 'meteofrance', category: 'Global', params: PARAMS_WITH_VISIBILITY, enabled: true },
  { key: 'bom_access_global', name: 'ACCESS-G 12km', apiName: 'access-g', endpoint: 'bom', category: 'Global', params: PARAMS_NO_VISIBILITY, enabled: true },
  { key: 'bom_access_g2', name: 'BOM ACCESS-G 17km', apiName: 'access-g2', endpoint: 'bom', category: 'Global', params: PARAMS_BOM_ACCESS_G2, enabled: true },

  // GFS ENDPOINT
  { key: 'gfs_global', name: 'GFS 11km', apiName: 'gfs_global', endpoint: 'gfs', category: 'Global', params: PARAMS_FULL, enabled: true },
  { key: 'gfs_graphcast025', name: 'GFS GraphCast 25km', apiName: 'gfs_graphcast025', endpoint: 'gfs', category: 'Global', params: PARAMS_LIMITED, enabled: true },
  { key: 'nam_conus', name: 'NAM Conus 5km', apiName: 'nam_conus', endpoint: 'gfs', category: 'North American Regional', params: PARAMS_FULL, forecastDays: 3, enabled: true },
  { key: 'hrrr_subhourly', name: 'HRRR Conus 3km', apiName: 'hrrr_subhourly', endpoint: 'gfs', category: 'North American Regional', params: PARAMS_FULL, forecastDays: 2, enabled: true },
  
  // GEM ENDPOINT
  { key: 'gem_global', name: 'GEM Global 15km (GDPS)', apiName: 'global', endpoint: 'gem', category: 'Canadian', params: PARAMS_HRDPS_RDPS, enabled: true },
  { key: 'hrdps_continental', name: 'HRDPS Continental 2.5km', apiName: 'hrdps_continental', endpoint: 'gem', category: 'North American Regional', params: PARAMS_HRDPS_RDPS, forecastDays: 2, enabled: true },
  { key: 'gem_regional', name: 'GEM Regional 10km (RDPS)', apiName: 'regional', endpoint: 'gem', category: 'Canadian', params: PARAMS_HRDPS_RDPS, enabled: true },
  
  // ECMWF ENDPOINT
  { key: 'ecmwf_ifs', name: 'ECMWF IFS 9km', apiName: 'ecmwf_ifs', endpoint: 'ecmwf', category: 'Global', params: PARAMS_ECMWF_IFS, enabled: true },
  { key: 'aifs025', name: 'AIFS 25km', apiName: 'aifs025', endpoint: 'ecmwf', category: 'Global', params: PARAMS_AIFS, enabled: true },

  // Derived Models
  { key: 'median_model', name: 'Median of Models', apiName: 'median_model', category: 'Derived', params: [] },
  { key: 'super_ensemble', name: 'Super Ensemble', apiName: 'super_ensemble', category: 'Derived', params: [] },
];

export const METRICS: Metric[] = [
    { key: 'overview', label: 'Overview', unit: '' },
    { key: 'temperature_2m', label: 'Temperature', unit: '°C' },
    { key: 'rain', label: 'Rainfall', unit: 'mm' },
    { key: 'snowfall', label: 'Snowfall', unit: 'cm' },
    { key: 'wind_speed_10m', label: 'Wind Speed', unit: 'kn' },
    { key: 'wind_gusts_10m', label: 'Wind Gusts', unit: 'kn' },
    { key: 'cloud_cover', label: 'Cloud Cover', unit: '%' },
    { key: 'visibility', label: 'Visibility', unit: 'mi' },
];

// Define which metrics are eligible for accuracy tracking.
// The 'overview' metric is a composite view and not a single data point, so it is excluded.
export const TRACKABLE_METRICS: Metric[] = METRICS.filter(m => m.key !== 'overview');

export const MODEL_COLORS: { [key:string]: string } = {
  // Canadian
  gem_global: '#3498db',
  gem_regional: '#2ecc71',
  hrdps_continental: '#9b59b6',
  // North American Regional
  nam_conus: '#2980b9',
  hrrr_subhourly: '#16a085',
  // Global
  gfs_global: '#f1c40f',
  gfs_graphcast025: '#e67e22',
  icon_global: '#4caf50',
  ecmwf_ifs: '#2c3e50',
  aifs025: '#7f8c8d',
  arpege_world: '#27ae60',
  bom_access_global: '#34495e',
  bom_access_g2: '#d35400',
  jma_gsm: '#ff69b4',
  cma_grapes_global: '#e74c3c',
  // Derived
  median_model: '#fafafa', // White
  super_ensemble: '#f39c12',
};