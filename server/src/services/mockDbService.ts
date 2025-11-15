

import { AccuracyInterval, AccuracyScore, PendingForecast, ActualWeatherRecord, HistoricalForecastRecord } from '../types.js';
import { MODELS } from '../constants.js';

export const initDB = async (): Promise<boolean> => {
  console.log('[DB] Mock database initialized successfully.');
  return true;
};

export const areAccuracyStoresEmpty = async (): Promise<boolean> => {
  return true;
};

export const addPendingForecasts = async (forecasts: Omit<PendingForecast, 'id'>[]): Promise<void> => {
  console.log(`[DB] Mock: Added ${forecasts.length} pending forecasts.`);
};

export const addActualWeather = async (record: Omit<ActualWeatherRecord, 'id'>): Promise<void> => {
  console.log(`[DB] Mock: Added actual weather record for ${record.time}.`);
};

export const getDuePendingForecasts = async (cutoff: Date): Promise<PendingForecast[]> => {
  console.log(`[DB] Mock: Returning empty list of due pending forecasts.`);
  return [];
};

export const getLatestActualWeatherTime = async (locationId: number): Promise<string | null> => {
  console.log(`[DB] Mock: Returning null for latest actual weather time.`);
  return null;
};

export const getActualsForLocationAndTimeRange = async (locationId: number, minTime: string, maxTime: string): Promise<ActualWeatherRecord[]> => {
  console.log(`[DB] Mock: Returning empty list of actuals for location and time range.`);
  return [];
};

export const getHistoricalForecasts = async (locationId: number, minTime: string, maxTime: string): Promise<HistoricalForecastRecord[]> => {
  console.log(`[DB] Mock: Returning empty list of historical forecasts.`);
  return [];
};

export const getAccuracyScores = async (): Promise<AccuracyScore[]> => {
  console.log(`[DB] Mock: Returning empty list of accuracy scores.`);
  return [];
};

export const applyAccuracyUpdatesAndDelete = async (
  updates: Array<{ locationId: number; locationName: string; modelKey: string; metricKey: string; error: number; interval: AccuracyInterval }>,
  idsToDelete: number[],
  historicalRecordsToAdd: Omit<HistoricalForecastRecord, 'id'>[]
): Promise<void> => {
  console.log(`[DB] Mock: Applied ${updates.length} accuracy updates and deleted ${idsToDelete.length} records.`);
};

export const clearOldData = async (cutoffDate: Date): Promise<void> => {
  console.log(`[DB] Mock: Cleared old data before ${cutoffDate.toISOString()}.`);
};

export const clearAccuracyData = async (): Promise<void> => {
  console.log('[DB] Mock: Cleared all accuracy data.');
};

export const getLease = async (id: string): Promise<any> => {
  console.log(`[DB] Mock: Returning null for lease ${id}.`);
  return null;
};

export const setLease = async (lease: any): Promise<void> => {
  console.log(`[DB] Mock: Set lease ${lease.id} for holder ${lease.holderId}.`);
};

