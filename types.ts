

export type ForecastView = 'hourly' | 'daily' | 'accuracy';

export type AccuracyInterval = '24h' | '48h' | '5d';

export interface Metric {
  key: 'overview' | 'temperature_2m' | 'rain' | 'snowfall' | 'wind_speed_10m' | 'wind_gusts_10m' | 'cloud_cover' | 'visibility';
  label: string;
  unit: string;
}

export interface Model {
  key: string; // Unique identifier for use within the app (e.g., 'gem_global')
  name: string;
  apiName: string; // Name for the 'models' parameter in the API call (e.g., 'global')
  endpoint?: 'forecast' | 'gem' | 'ecmwf' | 'gfs' | 'bom' | 'meteofrance';
  category: 'Canadian' | 'Global' | 'North American Regional' | 'Derived';
  params: string[];
  forecastDays?: number;
  enabled?: boolean;
}

export interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1: string; // State or Province
}

export interface GeocodingResponse {
  results: Location[];
}

export interface CurrentWeather {
  temperature_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  weather_code: number;
  is_day: number;
  time: string;
  rain: number;
  snowfall: number;
  wind_gusts_10m: number;
  cloud_cover: number;
  visibility: number;
  dew_point_2m: number;
  pressure_msl: number;
  cloud_cover_low: number;
  cloud_cover_mid: number;
  cloud_cover_high: number;
}

export interface HourlyUnit {
  time: string;
  temperature_2m: string;
  precipitation: string;
  rain: string;
  snowfall: string;
  wind_speed_10m: string;
  wind_direction_10m: string;
  wind_gusts_10m: string;
  cloud_cover: string;
  visibility: string;
}

export interface HourlyData {
  time: string[];
  temperature_2m?: (number | null)[];
  precipitation?: (number | null)[];
  rain?: (number | null)[];
  snowfall?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  cloud_cover?: (number | null)[];
  visibility?: (number | null)[];
}

export interface DailyUnit {
    time: string;
    temperature_2m_max: string;
    temperature_2m_min: string;
    precipitation_sum: string;
    rain_sum: string;
    snowfall_sum: string;
    wind_speed_10m_max: string;
    wind_gusts_10m_max: string;
    wind_direction_10m_dominant: string;
}

export interface DailyData {
    time: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
    rain_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
    wind_direction_10m_dominant?: (number | null)[];
}

export interface OpenMeteoModelResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units?: HourlyUnit;
  hourly?: HourlyData;
  daily_units?: DailyUnit;
  daily?: DailyData;
  current?: CurrentWeather;
  model?: string; // This will hold our unique model `key`
}

export interface ProcessedHourlyData {
  time: string;
  temperature_2m: number | null;
  temperature_2m_max?: number | null;
  temperature_2m_min?: number | null;
  precipitation: number | null;
  rain: number | null;
  snowfall: number | null;
  wind_speed_10m: number | null;
  wind_speed_10m_max?: number | null;
  wind_direction_10m: string | null;
  wind_gusts_10m: number | null;
  wind_gusts_10m_max?: number | null;
  cloud_cover: number | null;
  visibility: number | null;
  precipitation_type: number | null;
}

export interface ModelData {
  hourly: ProcessedHourlyData[];
}

export interface ProcessedForecasts {
  [modelKey: string]: ModelData;
}

export interface ComparisonChartProps {
  hourlyData: ProcessedForecasts;
  dailyData: ProcessedForecasts;
  metric: Metric;
  activeView: ForecastView;
}

export interface ForecastCardProps {
  modelName: string;
  data: ModelData;
  activeView: ForecastView;
}

export interface HeaderProps {
    location: Location;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onSearchFocus: () => void;
}

export interface PendingForecast {
  id?: number;
  locationId: number;
  modelKey: string;
  metricKey: string;
  targetTime: string; // ISO string
  forecastedValue: number;
  forecastLeadTimeHours: number;
}

export interface AccuracyScoreData {
    meanAbsoluteError: number;
    hoursTracked: number;
}

export interface AccuracyScore {
  locationId: number;
  locationName: string;
  modelKey: string;
  modelName: string;
  scores: {
    [metricKey: string]: {
      '24h': AccuracyScoreData;
      '48h': AccuracyScoreData;
      '5d': AccuracyScoreData;
    };
  };
}

export interface ModelError {
  modelName: string;
  reason: string;
}

export interface ActualWeatherRecord {
  id?: number;
  locationId: number;
  time: string; // ISO string, top of the hour, e.g., "2000-01-01T00:00:00.000Z"
  temperature_2m: number | null;
  rain: number | null;
  snowfall: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  cloud_cover: number | null;
  visibility: number | null;
}

export interface HistoricalForecastRecord {
  id?: number;
  locationId: number;
  modelKey: string;
  metricKey: string;
  targetTime: string; // ISO string
  forecastLeadTimeHours: number;
  forecastedValue: number;
  actualValue: number;
  error: number;
}