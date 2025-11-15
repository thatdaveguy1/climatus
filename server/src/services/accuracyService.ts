import { initDB, getDuePendingForecasts, addPendingForecasts, addActualWeather, getLatestActualWeatherTime, clearOldData, getActualsForLocationAndTimeRange, applyAccuracyUpdatesAndDelete, getLease, setLease, areAccuracyStoresEmpty } from './mockDbService.js';
import { fetchPastWeather, fetchRawModelRunsForAccuracy } from './openMeteoService.js';
import { ACCURACY_LOCATIONS, LAST_ACCURACY_CHECK_KEY, MODELS, TRACKABLE_METRICS, ACCURACY_FIRST_RUN_KEY, ACCURACY_MAX_FORECAST_HOURS, ACCURACY_STALE_FORECAST_HOURS } from '../constants.js';
import { PendingForecast, AccuracyInterval, ActualWeatherRecord, HistoricalForecastRecord, OpenMeteoModelResponse } from '../types.js';

// Do not score forecasts with lead time < 1h to avoid initialization bias.
// Warm-up period MUST remain 1h; changing this affects all accuracy metrics.
const ACCURACY_FORECAST_START_HOUR = 1;
const LEASE_ID = 'accuracy-runner-lease';
const LEASE_DURATION = 90 * 1000; // 90 seconds
const LEASE_RENEWAL_INTERVAL = 60 * 1000; // 60 seconds
const myId = Math.random().toString();
let leaseInterval: NodeJS.Timeout | null = null;
let isLeader = false;


const syncActualWeather = async () => {
    console.log(`[Accuracy] Syncing actual weather for ${ACCURACY_LOCATIONS.length} locations...`);
    for (const location of ACCURACY_LOCATIONS) {
        try {
            const latestTimeStr = await getLatestActualWeatherTime(location.id);
            const now = new Date();
            now.setMinutes(0, 0, 0); 

            let startTime: Date;
            if (latestTimeStr) {
                // Start from the next hour after the last recorded one
                startTime = new Date(new Date(latestTimeStr).getTime() + 3600 * 1000);
            } else {
                console.log(`No existing actual weather for ${location.name}. Performing initial sync for the last 14 days to build baseline.`);
                startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            }
            
            // Fetch up to the last full hour, leaving a small buffer
            const endTime = new Date(now.getTime() - 3600 * 1000);

            if (startTime >= endTime) {
                console.log(`[Accuracy] Actual weather for ${location.name} is already up to date. Skipping sync.`);
                continue;
            }
            
            const daysToFetch = Math.ceil((endTime.getTime() - startTime.getTime()) / (24 * 3600 * 1000));
            if (daysToFetch <= 0) continue;

            const records = await fetchPastWeather(location.latitude, location.longitude, daysToFetch);
            
            const recordsToAdd = records.filter(r => r.time && new Date(r.time).getTime() >= startTime.getTime());

            for (const record of recordsToAdd) {
                // FIX: The `record` from fetchPastWeather is Partial<...>, but `addActualWeather` expects a full object.
                // We construct the object manually, providing `null` defaults for any missing metrics to satisfy the type.
                await addActualWeather({
                    locationId: location.id,
                    time: record.time!,
                    temperature_2m: record.temperature_2m ?? null,
                    rain: record.rain ?? null,
                    snowfall: record.snowfall ?? null,
                    wind_speed_10m: record.wind_speed_10m ?? null,
                    wind_gusts_10m: record.wind_gusts_10m ?? null,
                    cloud_cover: record.cloud_cover ?? null,
                    visibility: record.visibility ?? null,
                });
            }
            console.log(`[Accuracy] Synced ${recordsToAdd.length} new actual weather records for ${location.name}.`);

        } catch (err) {
            console.error(`[Accuracy] Failed to sync actual weather for ${location.name}:`, err);
        }
    }
};


const storeFutureForecasts = async () => {
    console.log('[Accuracy] Storing future forecasts for all locations...');
    for (const location of ACCURACY_LOCATIONS) {
        try {
            const { successes } = await fetchRawModelRunsForAccuracy(location.latitude, location.longitude);
            const forecastsToAdd: Omit<PendingForecast, 'id'>[] = [];

            for (const result of successes) {
                const generationTime = new Date(result.generationtime_ms);
                const modelKey = result.model;
                if (!result.hourly?.time) continue;
                
                for (let i = 0; i < result.hourly.time.length; i++) {
                    const targetTime = new Date(result.hourly.time[i] + 'Z');
                    
                    if (targetTime.getTime() > Date.now() + ACCURACY_MAX_FORECAST_HOURS * 3600 * 1000) {
                        continue; 
                    }

                    const forecastLeadTimeHours = Math.round((targetTime.getTime() - generationTime.getTime()) / 3600000);
                    
                    if (forecastLeadTimeHours < ACCURACY_FORECAST_START_HOUR) {
                        continue;
                    }

                    for (const metric of TRACKABLE_METRICS) {
                        const hourlyDataForMetric = result.hourly[metric.key as keyof typeof result.hourly];
                        if (Array.isArray(hourlyDataForMetric)) {
                            const value = hourlyDataForMetric[i];
                            if (typeof value === 'number' && isFinite(value)) {
                                forecastsToAdd.push({
                                    locationId: location.id,
                                    modelKey,
                                    metricKey: metric.key,
                                    targetTime: targetTime.toISOString(),
                                    forecastedValue: value,
                                    forecastLeadTimeHours,
                                });
                            }
                        }
                    }
                }
            }
            if (forecastsToAdd.length > 0) {
                await addPendingForecasts(forecastsToAdd);
                console.log(`[Accuracy] Stored ${forecastsToAdd.length} new pending forecast points for ${location.name}.`);
            }
        } catch (err) {
            console.error(`[Accuracy] Failed to store future forecasts for ${location.name}:`, err);
        }
    }
};

const processPastForecasts = async () => {
    console.log('[Accuracy] Processing past due forecasts...');
    const now = new Date();
    const cutoff = new Date(now.getTime() - 3600 * 1000);
    const dueForecasts = await getDuePendingForecasts(cutoff);

    if (dueForecasts.length === 0) {
        console.log('[Accuracy] No forecasts are due for processing.');
        return;
    }

    console.log(`[Accuracy] Found ${dueForecasts.length} forecasts to process.`);
    const updates = [];
    const historicalRecordsToAdd: Omit<HistoricalForecastRecord, 'id'>[] = [];
    const idsToDelete = dueForecasts.map(f => f.id!);

    const forecastsByLocation = dueForecasts.reduce((acc, f) => {
        (acc[f.locationId] = acc[f.locationId] || []).push(f);
        return acc;
    }, {} as Record<number, PendingForecast[]>);

    for (const locationIdStr in forecastsByLocation) {
        const locationId = parseInt(locationIdStr, 10);
        const locationForecasts = forecastsByLocation[locationId];
        const location = ACCURACY_LOCATIONS.find(l => l.id === locationId);
        if (!location) continue;

        const minTime = locationForecasts.reduce((min, f) => f.targetTime < min ? f.targetTime : min, locationForecasts[0].targetTime);
        const maxTime = locationForecasts.reduce((max, f) => f.targetTime > max ? f.targetTime : max, locationForecasts[0].targetTime);
        
        const actuals = await getActualsForLocationAndTimeRange(locationId, minTime, maxTime);
        const actualsMap = new Map(actuals.map(a => [a.time, a]));

        for (const forecast of locationForecasts) {
            if (forecast.forecastLeadTimeHours < ACCURACY_FORECAST_START_HOUR) {
                continue;
            }

            const actual = actualsMap.get(forecast.targetTime);
            if (!actual) continue;

            const actualValue = actual[forecast.metricKey as keyof ActualWeatherRecord];
            if (typeof actualValue !== 'number' || !isFinite(actualValue)) continue;
            
            const error = Math.abs(forecast.forecastedValue - actualValue);
            let interval: AccuracyInterval;
            if (forecast.forecastLeadTimeHours <= 24) interval = '24h';
            else if (forecast.forecastLeadTimeHours <= 48) interval = '48h';
            else interval = '5d';

            updates.push({
                locationId,
                locationName: location.name,
                modelKey: forecast.modelKey,
                metricKey: forecast.metricKey,
                error,
                interval,
            });
            
            historicalRecordsToAdd.push({
                locationId,
                modelKey: forecast.modelKey,
                metricKey: forecast.metricKey,
                targetTime: forecast.targetTime,
                forecastLeadTimeHours: forecast.forecastLeadTimeHours,
                forecastedValue: forecast.forecastedValue,
                actualValue,
                error,
            });
        }
    }

    if (updates.length > 0 || idsToDelete.length > 0) {
        await applyAccuracyUpdatesAndDelete(updates, idsToDelete, historicalRecordsToAdd);
        console.log(`[Accuracy] Successfully processed ${updates.length} forecasts and deleted ${idsToDelete.length} pending items.`);
    }
};

const acquireLease = async (): Promise<boolean> => {
    try {
        const lease = await getLease(LEASE_ID);
        const now = Date.now();
        if (!lease || (now - lease.timestamp > LEASE_DURATION) || lease.holderId === myId) {
            await setLease({ id: LEASE_ID, holderId: myId, timestamp: now });
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Accuracy] Error acquiring lease:', error);
        return false;
    }
};

const renewLease = async () => {
    try {
        const lease = await getLease(LEASE_ID);
        if (lease && lease.holderId === myId) {
            await setLease({ id: LEASE_ID, holderId: myId, timestamp: Date.now() });
        } else {
            console.log('[Accuracy] Lost lease, stopping renewal.');
            if (leaseInterval) clearInterval(leaseInterval);
            isLeader = false;
        }
    } catch (error) {
        console.error('[Accuracy] Error renewing lease:', error);
    }
};

const fullUpdateCycle = async () => {
    console.log('[Accuracy] Starting full update cycle...');
    const startTime = Date.now();
    try {
        await syncActualWeather();
        await storeFutureForecasts();
        await processPastForecasts();
        const staleCutoff = new Date(Date.now() - ACCURACY_STALE_FORECAST_HOURS * 3600 * 1000);
        await clearOldData(staleCutoff);
    } catch (err) {
        console.error('[Accuracy] Full update cycle failed:', err);
    } finally {
        const duration = (Date.now() - startTime) / 1000;
        console.log(`[Accuracy] Full update cycle finished in ${duration.toFixed(2)} seconds.`);
    }
};

const initialSetup = async () => {
    console.log("[Accuracy] Performing initial setup check...");
    const firstRunTimestamp = null; // Not using localStorage in server environment
    const storesAreEmpty = await areAccuracyStoresEmpty();

    if (storesAreEmpty) {
        console.log("[Accuracy] First run detected or database is empty. Seeding data...");
        await fullUpdateCycle();
    } else {
        console.log("[Accuracy] Existing data found. Proceeding with normal hourly check.");
    }
};

export const checkAndRunHourlyUpdate = async () => {
    console.log('[Accuracy] checkAndRunHourlyUpdate called.');
    try {
        await initDB();
        isLeader = await acquireLease();
        if (!isLeader) {
            console.log('[Accuracy] Not the leader. Skipping hourly update.');
            return;
        }

        console.log('[Accuracy] Acquired leader lease. Running hourly update.');
        if (leaseInterval) clearInterval(leaseInterval);
        leaseInterval = setInterval(renewLease, LEASE_RENEWAL_INTERVAL);
        
        await initialSetup(); 

        const now = Date.now();
        const oneHour = 3600 * 1000;
        let lastCheck = await getLease('last-accuracy-check');

        if (!lastCheck || (now - lastCheck.timestamp) > oneHour) {
            await fullUpdateCycle();
            await setLease({ id: 'last-accuracy-check', holderId: 'accuracy-service', timestamp: now });
        } else {
            console.log('[Accuracy] Less than an hour since last full update. Skipping.');
        }

    } catch (err) {
        console.error('[Accuracy] Critical error in checkAndRunHourlyUpdate:', err);
    }
};

export const runFullAccuracyCycleNow = async () => {
    console.log('[Accuracy] Manually triggering a full accuracy update cycle...');
    try {
        await initDB();
        await fullUpdateCycle();
        await setLease({ id: 'last-accuracy-check', holderId: 'accuracy-service', timestamp: Date.now() });
        console.log('[Accuracy] Manual update cycle completed successfully.');
    } catch (err) {
        console.error('[Accuracy] Manual full update cycle failed:', err);
        throw err;
    }
};