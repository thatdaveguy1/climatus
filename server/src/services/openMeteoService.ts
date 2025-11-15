

import { MODELS, isUSMainland } from '../constants.js';
import { OpenMeteoModelResponse, ProcessedForecasts, ProcessedHourlyData, Model, ForecastView, GeocodingResponse, Location, ModelError, CurrentWeather, ActualWeatherRecord, HourlyData, DailyData } from '../types.js';

const API_ENDPOINTS = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  gem: 'https://api.open-meteo.com/v1/gem',
  ecmwf: 'https://api.open-meteo.com/v1/ecmwf',
  gfs: 'https://api.open-meteo.com/v1/gfs',
  archive: 'https://archive-api.open-meteo.com/v1/archive',
  bom: 'https://api.open-meteo.com/v1/bom',
  meteofrance: 'https://api.open-meteo.com/v1/meteofrance',
};

// --- Request Queue for Rate Limiting ---
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
const MIN_REQUEST_INTERVAL = 100; // ms between requests

async function queuedFetch(url: string, options?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const response = await fetch(url, { ...options, cache: 'no-store' });
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
    
    if (!isProcessingQueue) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (isProcessingQueue) {
    return;
  }
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      await nextRequest();
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
    }
  }

  isProcessingQueue = false;
}

// Per user patch request
const ALLOWED: Record<string, Set<string>> = {
  gfs: new Set(['gfs_global','gfs_graphcast','nam','nam_conus','hrrr','hrrr_subhourly']),
  forecast: new Set(['ukmo_global','ukmo_ukv','icon_global','arpege_global','access_g','gem_global']),
};

// FIX: Made the endpoint routing comprehensive to handle all model types.
function getEndpointAndParam(model: Model) {
  switch (model.endpoint) {
    case 'gfs':
      return { base: API_ENDPOINTS.gfs, paramName: 'models', paramValue: model.apiName };
    case 'gem':
      return { base: API_ENDPOINTS.gem, paramName: 'domain', paramValue: model.apiName };
    case 'bom':
      return { base: API_ENDPOINTS.bom, paramName: 'domain', paramValue: model.apiName };
    case 'meteofrance':
      return { base: API_ENDPOINTS.meteofrance, paramName: 'domain', paramValue: model.apiName };
    case 'ecmwf':
      return { base: API_ENDPOINTS.ecmwf, paramName: undefined, paramValue: undefined };
    case 'forecast':
    default:
      return { base: API_ENDPOINTS.forecast, paramName: 'models', paramValue: model.apiName };
  }
}

const normalizeHourlyDataKeys = (hourly: HourlyData): HourlyData => {
  const map: Record<string,string> = {
    windspeed_10m: 'wind_speed_10m',
    winddirection_10m: 'wind_direction_10m',
    windgusts_10m: 'wind_gusts_10m',
    cloudcover: 'cloud_cover',
  };
  const suffixes = ['', '_mean', '_dominant', '_percentile_25', '_percentile_50', '_percentile_75'];
  const out: any = { ...hourly };
  for (const [bad, good] of Object.entries(map)) {
    for (const s of suffixes) {
      const from = `${bad}${s}`, to = `${good}${s}`;
      if (from in out) { out[to] = out[from]; delete out[from]; }
    }
  }
  out.time = hourly.time;
  return out as HourlyData;
};


export const fetchCurrentWeather = async (latitude: number, longitude: number): Promise<{ current: CurrentWeather | null; timezoneAbbreviation?: string; error?: string }> => {
    try {
        const currentParams = 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,wind_gusts_10m,cloud_cover,visibility,rain,snowfall,dew_point_2m,pressure_msl';
        // Request low/mid/high cloud cover; names must match Open-Meteo docs (cloud_cover_low/mid/high).
        const hourlyCloudParams = 'temperature_2m,cloud_cover_low,cloud_cover_mid,cloud_cover_high';
        
        const params = new URLSearchParams({
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            current: currentParams,
            hourly: hourlyCloudParams,
            forecast_days: '1', // We only need a few hours to find the closest one
            wind_speed_unit: 'kn',
            temperature_unit: 'celsius',
            precipitation_unit: 'mm',
        });
        const url = `${API_ENDPOINTS.forecast}?${params.toString()}`;
        console.log(`[API] Fetching current weather from: ${url}`);
        const response = await queuedFetch(url);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`[API] Successfully fetched current weather.`);
            
            // Augment current weather with cloud layer data from the closest hourly forecast point
            if (data.current && data.hourly && data.hourly.time?.length > 0) {
                const currentTime = new Date(data.current.time).getTime();
                let closestHourIndex = 0;
                let minDiff = Infinity;
                
                data.hourly.time.forEach((t: string, i: number) => {
                    const diff = Math.abs(new Date(t).getTime() - currentTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestHourIndex = i;
                    }
                });

                data.current.cloud_cover_low = data.hourly.cloud_cover_low?.[closestHourIndex] ?? data.current.cloud_cover ?? 0;
                data.current.cloud_cover_mid = data.hourly.cloud_cover_mid?.[closestHourIndex] ?? 0;
                data.current.cloud_cover_high = data.hourly.cloud_cover_high?.[closestHourIndex] ?? 0;
            }

            return {
                current: data.current || null,
                timezoneAbbreviation: data.timezone_abbreviation,
            };
        } else {
            const errorData = await response.json();
            console.error(`[API] Error fetching current weather (${response.status}):`, errorData);
            return { current: null, error: errorData.reason || 'Failed to fetch current weather.' };
        }
    } catch (error) {
        console.error('[API] Network error fetching current weather:', error);
        return { current: null, error: 'A network error occurred while fetching current weather.' };
    }
};

export const searchLocations = async (query: string): Promise<Location[]> => {
    if (query.length < 3) return [];
    try {
        const params = new URLSearchParams({
            name: query,
            count: '10',
            language: 'en',
            format: 'json',
        });
        const url = `${GEOCODING_API_BASE_URL}?${params.toString()}`;
        console.log(`[API] Searching locations with URL: ${url}`);
        const response = await queuedFetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch locations from geocoding API.');
        }
        const data: GeocodingResponse = await response.json();
        console.log(`[API] Geocoding search found ${data.results?.length ?? 0} results.`);
        return data.results || [];
    } catch (error) {
        console.error("[API] Error searching locations:", error);
        throw new Error('An error occurred while searching for locations.');
    }
};

const GEOCODING_API_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const windDirectionMap = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
];

export const degreesToCardinal = (degrees: number | null): string => {
    if (degrees === null || degrees === undefined) return '';
    const index = Math.round((degrees % 360) / 22.5) % 16;
    return windDirectionMap[index];
};

const calculateDerivedModels = (forecasts: ProcessedForecasts, view: ForecastView) => {
    console.log(`[Processing] Calculating derived models (median) for ${view} view...`);
    const modelKeys = Object.keys(forecasts).filter(key => {
        const model = MODELS.find(m => m.key === key);
        return model && model.category !== 'Derived';
    });

    if (modelKeys.length === 0) {
        console.log('[Processing] No models available to calculate derived models.');
        return;
    }

    const referenceTimes = forecasts[modelKeys[0]].hourly.map(h => h.time);
    const medianHourly: ProcessedHourlyData[] = [];

    for (const time of referenceTimes) {
        const valuesAtTime: { [key: string]: number[] } = {};

        for (const key of modelKeys) {
            const hourData = forecasts[key].hourly.find(h => h.time === time);
            if (!hourData) continue;
            
            for (const metric of Object.keys(hourData)) {
                const value = (hourData as any)[metric];
                if (typeof value === 'number' && isFinite(value)) {
                    if (!valuesAtTime[metric]) {
                        valuesAtTime[metric] = [];
                    }
                    valuesAtTime[metric].push(value);
                }
            }
        }

        if (Object.keys(valuesAtTime).length === 0) {
          continue;
        }

        const medianPoint: any = { time };
        for (const metric of Object.keys(valuesAtTime)) {
            const sorted = valuesAtTime[metric].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            medianPoint[metric] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }

        if (view === 'hourly') {
            const rain = medianPoint.rain ?? 0;
            const snow = medianPoint.snowfall ?? 0;
            let precipitation_type = 0;
            if (rain > 0.05) precipitation_type = 1; // rain
            if (snow > 0.05) precipitation_type = (precipitation_type === 1) ? 2 : 3; // mix or snow
            medianPoint.precipitation_type = precipitation_type;
        } else {
            medianPoint.precipitation_type = null;
        }

        medianHourly.push(medianPoint);
    }

    forecasts['median_model'] = { hourly: medianHourly };
    console.log('[Processing] Finished calculating derived models.');
};

const processIndividualForecasts = (apiResponses: (OpenMeteoModelResponse & { model: string })[], view: ForecastView): ProcessedForecasts => {
    const processed: ProcessedForecasts = {};

    for (const response of apiResponses) {
        const modelKey = response.model;
        
        if (view === 'daily') {
            const dailyData = response.daily;
            if (!dailyData || !dailyData.time || dailyData.time.length === 0) continue;

            const processedDaily: ProcessedHourlyData[] = dailyData.time.map((t, i) => ({
                time: t,
                temperature_2m: null,
                temperature_2m_max: dailyData.temperature_2m_max?.[i] ?? null,
                temperature_2m_min: dailyData.temperature_2m_min?.[i] ?? null,
                precipitation: dailyData.precipitation_sum?.[i] ?? null,
                rain: dailyData.rain_sum?.[i] ?? null,
                snowfall: dailyData.snowfall_sum?.[i] ?? null, // API provides this in cm
                wind_speed_10m: null,
                wind_speed_10m_max: dailyData.wind_speed_10m_max?.[i] ?? null,
                wind_direction_10m: degreesToCardinal(dailyData.wind_direction_10m_dominant?.[i] ?? null),
                wind_gusts_10m: null,
                wind_gusts_10m_max: dailyData.wind_gusts_10m_max?.[i] ?? null,
                cloud_cover: null,
                visibility: null,
                precipitation_type: null,
            }));
            processed[modelKey] = { hourly: processedDaily };

        } else { // Hourly processing
            const hourlyData = response.hourly;
            if (!hourlyData || !hourlyData.time || hourlyData.time.length === 0) continue;

            const processedHourly: ProcessedHourlyData[] = hourlyData.time.map((t, i) => {
                const rain = hourlyData.rain?.[i];
                const snow = hourlyData.snowfall?.[i];
                let precipitation = hourlyData.precipitation?.[i];
                
                if (precipitation === undefined && (rain !== undefined || snow !== undefined)) {
                    precipitation = (rain ?? 0) + (snow ?? 0);
                }

                let precipitation_type = 0; // 0=none, 1=rain, 2=mix, 3=snow
                if (rain && rain > 0) precipitation_type = 1;
                if (snow && snow > 0) precipitation_type = (precipitation_type === 1) ? 2 : 3;
                
                const visibility_val = hourlyData.visibility?.[i] ?? null;

                return {
                    time: t,
                    temperature_2m: hourlyData.temperature_2m?.[i] ?? null,
                    precipitation: precipitation ?? null,
                    rain: rain ?? null,
                    snowfall: (snow ?? null) !== null ? (snow as number) / 10 : null, // mm to cm
                    wind_speed_10m: hourlyData.wind_speed_10m?.[i] ?? null,
                    wind_direction_10m: degreesToCardinal(hourlyData.wind_direction_10m?.[i] ?? null),
                    wind_gusts_10m: hourlyData.wind_gusts_10m?.[i] ?? null,
                    cloud_cover: hourlyData.cloud_cover?.[i] ?? null,
                    visibility: visibility_val !== null ? visibility_val / 1609.34 : null, // meters to statute miles
                    precipitation_type,
                };
            });
            processed[modelKey] = { hourly: processedHourly };
        }
    }
    return processed;
};

type EndpointName = 'forecast' | 'gfs' | 'gem' | 'ecmwf' | 'bom' | 'meteofrance';

function extractModelData(payload: any, model: Model, endpointName: EndpointName, view: ForecastView) {
  const dataKey = view === 'daily' ? 'daily' : 'hourly';
  const unitsKey = view === 'daily' ? 'daily_units' : 'hourly_units';
  
  if (payload?.[dataKey] && payload?.[unitsKey]) {
    return { ...payload, model: model.key };
  }
  const block = payload?.models?.[model.apiName] || payload?.[model.apiName];
  if (block?.[dataKey] && block?.[unitsKey]) {
    const { models, [model.apiName]: _removed, ...baseData } = payload;
    return { ...baseData, ...block, model: model.key };
  }
  throw new Error(`Model data for '${model.apiName}' not found in response from '${endpointName}' endpoint for ${dataKey} view.`);
}

const DAILY_PARAMS = [
    'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'rain_sum', 'snowfall_sum', 
    'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant'
];

const fetchAndProcessModels = async (
  latitude: number,
  longitude: number,
  isAccuracyRun: boolean,
  view: ForecastView
): Promise<{ successes: (OpenMeteoModelResponse & { model: string })[], failures: ModelError[] }> => {
  
  let allModels = MODELS.filter(m => m.category !== 'Derived' && m.enabled !== false);
  
  const inUS = isUSMainland(latitude, longitude);
  const gatedModels = allModels.filter(m => {
      if (m.category === 'North American Regional' && !inUS) {
          return false;
      }
      return true;
  });
  if (gatedModels.length < allModels.length) {
      const skippedNames = allModels.filter(m => !gatedModels.includes(m)).map(m => m.name).join(', ');
      console.log(`[Domain Gating] Skipping models for non-US location: ${skippedNames}`);
  }
  const modelsToFetch = gatedModels;
  
  const logPrefix = isAccuracyRun ? '[Accuracy API]' : '[API]';
  console.log(`${logPrefix} Starting forecast fetch for ${modelsToFetch.length} enabled models for ${view} view.`);

  const successes: (OpenMeteoModelResponse & { model: string })[] = [];
  const failures: ModelError[] = [];

  const fetchPromises = modelsToFetch.map(async (model) => {
    try {
      const { base: baseUrl, paramName, paramValue } = getEndpointAndParam(model);
      const endpoint = (model.endpoint || 'forecast') as EndpointName;

      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        wind_speed_unit: 'kn',
        temperature_unit: 'celsius',
        precipitation_unit: 'mm',
        timezone: isAccuracyRun ? 'UTC' : 'auto',
      });

      if (view === 'daily') {
        params.append('daily', DAILY_PARAMS.join(','));
        params.append('forecast_days', '8');
      } else { // hourly for 'hourly' or 'accuracy'
        params.append('hourly', model.params.join(','));
        if (model.forecastDays) {
          params.append('forecast_days', model.forecastDays.toString());
        }
      }

      if (paramName && paramValue) {
        params.append(paramName, paramValue);
      }
      
      const url = `${baseUrl}?${params.toString()}`;
      console.log(`${logPrefix} Fetching for ${model.name} from: ${url}`);
      const response = await queuedFetch(url);
      const data = await response.json();

      if (data.error && data.reason) throw new Error(data.reason);
      
      const modelData = extractModelData(data, model, endpoint, view);
      // attach a fetchedAt timestamp (server-side) to use as generationTime for lead-time calculations
      const fetchedAt = new Date().toISOString();
      const normalizedPayload = { ...modelData, fetchedAt };
      if (view !== 'daily' && normalizedPayload.hourly) {
          normalizedPayload.hourly = normalizeHourlyDataKeys(modelData.hourly);
      }
      successes.push(normalizedPayload);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      console.error(`${logPrefix} Fetch failed for ${model.name}. Reason: ${errorMessage}`);
      failures.push({ modelName: model.name, reason: errorMessage });
    }
  });

  await Promise.all(fetchPromises);
  
  console.log(`${logPrefix} Fetch complete. Success: ${successes.length}, Failures: ${failures.length}.`);
  return { successes, failures };
};

export const fetchForecasts = async (
  view: ForecastView,
  latitude: number,
  longitude: number
): Promise<{ forecasts: ProcessedForecasts, errors: ModelError[] }> => {
  const { successes, failures } = await fetchAndProcessModels(latitude, longitude, false, view);
    
  console.log('[Processing] Starting to process individual forecast responses...');
  const processed = processIndividualForecasts(successes, view);
  calculateDerivedModels(processed, view);

  return { forecasts: processed, errors: failures };
};

export const fetchRawModelRunsForAccuracy = async (
  latitude: number,
  longitude: number
): Promise<{ successes: (OpenMeteoModelResponse & { model: string })[], failures: ModelError[] }> => {
  return fetchAndProcessModels(latitude, longitude, true, 'hourly');
};

export const fetchPastWeather = async (latitude: number, longitude: number, days: number): Promise<Partial<ActualWeatherRecord>[]> => {
    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const endDate = new Date(nowMs).toISOString().split('T')[0];
    const startDate = new Date(nowMs - (days * oneDayMs)).toISOString().split('T')[0];
    
    const hourlyParams = 'temperature_2m,rain,snowfall,wind_speed_10m,wind_gusts_10m,cloud_cover,visibility';

    const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        start_date: startDate,
        end_date: endDate,
        hourly: hourlyParams,
        wind_speed_unit: 'kn',
        temperature_unit: 'celsius',
        precipitation_unit: 'mm',
        timezone: 'UTC',
    });
    
    const url = `${API_ENDPOINTS.archive}?${params.toString()}`;
    console.log(`[API] Fetching past weather from archive: ${url}`);
    
    try {
        const response = await queuedFetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.reason || 'Failed to fetch past weather data.');
        }
        const data = await response.json();
        
        if (!data.hourly || !data.hourly.time) {
            console.warn('[API] Archive response contained no hourly data.');
            return [];
        }
        
        const records: Partial<ActualWeatherRecord>[] = data.hourly.time.map((t: string, i: number) => {
            const visibilityMeters = data.hourly.visibility?.[i] ?? null;
            return {
                time: new Date(t + 'Z').toISOString(),
                temperature_2m: data.hourly.temperature_2m?.[i] ?? null,
                rain: data.hourly.rain?.[i] ?? null,
                snowfall: (data.hourly.snowfall?.[i] ?? null) !== null ? data.hourly.snowfall[i] / 10 : null, // mm to cm
                wind_speed_10m: data.hourly.wind_speed_10m?.[i] ?? null,
                wind_gusts_10m: data.hourly.wind_gusts_10m?.[i] ?? null,
                cloud_cover: data.hourly.cloud_cover?.[i] ?? null,
                visibility: visibilityMeters !== null ? visibilityMeters / 1609.34 : null, // m to mi
            };
        });
        
        console.log(`[API] Successfully fetched and processed ${records.length} past weather records.`);
        return records;
    } catch (error) {
        console.error("[API] Error fetching past weather:", error);
        throw error;
    }
};