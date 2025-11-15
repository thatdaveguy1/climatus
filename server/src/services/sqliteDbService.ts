import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AccuracyInterval, AccuracyScore, PendingForecast, ActualWeatherRecord, HistoricalForecastRecord } from '../types.js';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'accuracy.db');
let db: any = null;

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
};

const initDB = async (): Promise<boolean> => {
  if (db) return true;
  ensureDataDir();
  db = new Database(DB_PATH);

  // Enable WAL for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Create tables if they don't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pending_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locationId INTEGER,
      modelKey TEXT,
      metricKey TEXT,
      targetTime TEXT,
      forecastedValue REAL,
      forecastLeadTimeHours INTEGER,
      generationTime TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS actual_weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locationId INTEGER,
      time TEXT UNIQUE,
      temperature_2m REAL,
      rain REAL,
      snowfall REAL,
      wind_speed_10m REAL,
      wind_gusts_10m REAL,
      cloud_cover REAL,
      visibility REAL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS historical_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locationId INTEGER,
      modelKey TEXT,
      metricKey TEXT,
      targetTime TEXT,
      forecastLeadTimeHours INTEGER,
      forecastedValue REAL,
      actualValue REAL,
      error REAL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS accuracy_scores (
      locationId INTEGER,
      modelKey TEXT,
      locationName TEXT,
      modelName TEXT,
      metricKey TEXT,
      intervalKey TEXT,
      meanAbsoluteError REAL,
      hoursTracked INTEGER,
      PRIMARY KEY (locationId, modelKey, metricKey, intervalKey)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS leader_lease (
      id TEXT PRIMARY KEY,
      holderId TEXT,
      timestamp INTEGER
    )
  `).run();

  // Ensure migration: add generationTime column to pending_forecasts if missing (safe to run repeatedly)
  try {
    const cols = db.prepare("PRAGMA table_info(pending_forecasts)").all().map((r: any) => r.name);
    if (!cols.includes('generationTime')) {
      db.prepare("ALTER TABLE pending_forecasts ADD COLUMN generationTime TEXT").run();
    }
  } catch (err) {
    // If the table doesn't exist yet or other issue, ignore - it will be created above
    console.warn('[DB-SQLITE] migration check for generationTime failed', err);
  }

  return true;
};

const areAccuracyStoresEmpty = async (): Promise<boolean> => {
  if (!db) throw new Error('DB not initialized');
  const pending = db.prepare('SELECT COUNT(1) as c FROM pending_forecasts').get().c as number;
  const actual = db.prepare('SELECT COUNT(1) as c FROM actual_weather').get().c as number;
  return pending === 0 && actual === 0;
};

const addPendingForecasts = async (forecasts: Omit<PendingForecast, 'id'>[]): Promise<void> => {
  if (!db) throw new Error('DB not initialized');
  const insert = db.prepare(`INSERT INTO pending_forecasts (locationId, modelKey, metricKey, targetTime, forecastedValue, forecastLeadTimeHours, generationTime) VALUES (@locationId, @modelKey, @metricKey, @targetTime, @forecastedValue, @forecastLeadTimeHours, @generationTime)`);
  const insertMany = db.transaction((rows: any[]) => {
    for (const r of rows) insert.run(r);
  });
  insertMany(forecasts.map(f => ({
    locationId: f.locationId,
    modelKey: f.modelKey,
    metricKey: f.metricKey,
    targetTime: f.targetTime,
    forecastedValue: f.forecastedValue,
    forecastLeadTimeHours: f.forecastLeadTimeHours,
    generationTime: (f as any).generationTime || null,
  })));
};

const addActualWeather = async (record: Omit<ActualWeatherRecord, 'id'>): Promise<void> => {
  if (!db) throw new Error('DB not initialized');
  try {
    const stmt = db.prepare(`INSERT OR IGNORE INTO actual_weather (locationId, time, temperature_2m, rain, snowfall, wind_speed_10m, wind_gusts_10m, cloud_cover, visibility) VALUES (@locationId, @time, @temperature_2m, @rain, @snowfall, @wind_speed_10m, @wind_gusts_10m, @cloud_cover, @visibility)`);
    stmt.run(record);
  } catch (err) {
    console.error('[DB-SQLITE] addActualWeather error', err);
  }
};

const getDuePendingForecasts = async (cutoff: Date): Promise<PendingForecast[]> => {
  if (!db) throw new Error('DB not initialized');
  const rows = db.prepare('SELECT * FROM pending_forecasts WHERE targetTime <= ?').all(cutoff.toISOString());
  return rows as PendingForecast[];
};

const getLatestActualWeatherTime = async (locationId: number): Promise<string | null> => {
  if (!db) throw new Error('DB not initialized');
  const row = db.prepare('SELECT time FROM actual_weather WHERE locationId = ? ORDER BY time DESC LIMIT 1').get(locationId);
  return row ? row.time as string : null;
};

const getActualsForLocationAndTimeRange = async (locationId: number, minTime: string, maxTime: string): Promise<ActualWeatherRecord[]> => {
  if (!db) throw new Error('DB not initialized');
  const rows = db.prepare('SELECT * FROM actual_weather WHERE locationId = ? AND time BETWEEN ? AND ? ORDER BY time').all(locationId, minTime, maxTime);
  return rows as ActualWeatherRecord[];
};

const getHistoricalForecasts = async (locationId: number, minTime: string, maxTime: string): Promise<HistoricalForecastRecord[]> => {
  if (!db) throw new Error('DB not initialized');
  const rows = db.prepare('SELECT * FROM historical_forecasts WHERE locationId = ? AND targetTime BETWEEN ? AND ?').all(locationId, minTime, maxTime);
  return rows as HistoricalForecastRecord[];
};

const getAccuracyScores = async (): Promise<AccuracyScore[]> => {
  if (!db) throw new Error('DB not initialized');
  const rows = db.prepare('SELECT locationId, modelKey, locationName, modelName, metricKey, intervalKey as interval, meanAbsoluteError, hoursTracked FROM accuracy_scores').all();
  const map = new Map<string, AccuracyScore>();
  for (const r of rows) {
    const key = `${r.locationId}-${r.modelKey}`;
    if (!map.has(key)) map.set(key, { locationId: r.locationId, modelKey: r.modelKey, locationName: r.locationName, modelName: r.modelName, scores: {} });
    const s = map.get(key)!;
    if (!s.scores[r.metricKey]) s.scores[r.metricKey] = { '24h': { meanAbsoluteError: 0, hoursTracked: 0 }, '48h': { meanAbsoluteError: 0, hoursTracked: 0 }, '5d': { meanAbsoluteError: 0, hoursTracked: 0 } };
    // TS-friendly assignment
    const intervalKey = r.interval as '24h' | '48h' | '5d';
    s.scores[r.metricKey][intervalKey] = { meanAbsoluteError: r.meanAbsoluteError, hoursTracked: r.hoursTracked };
  }
  return Array.from(map.values());
};

const applyAccuracyUpdatesAndDelete = async (
  updates: Array<{ locationId: number; locationName: string; modelKey: string; metricKey: string; error: number; interval: AccuracyInterval }>,
  idsToDelete: number[],
  historicalRecordsToAdd: Omit<HistoricalForecastRecord, 'id'>[]
): Promise<void> => {
  if (!db) throw new Error('DB not initialized');

  const insertHist = db.prepare('INSERT INTO historical_forecasts (locationId, modelKey, metricKey, targetTime, forecastLeadTimeHours, forecastedValue, actualValue, error) VALUES (@locationId, @modelKey, @metricKey, @targetTime, @forecastLeadTimeHours, @forecastedValue, @actualValue, @error)');
  const updStmt = db.prepare('INSERT INTO accuracy_scores (locationId, modelKey, locationName, modelName, metricKey, intervalKey, meanAbsoluteError, hoursTracked) VALUES (@locationId, @modelKey, @locationName, @modelName, @metricKey, @intervalKey, @meanAbsoluteError, @hoursTracked) ON CONFLICT(locationId, modelKey, metricKey, intervalKey) DO UPDATE SET meanAbsoluteError=excluded.meanAbsoluteError, hoursTracked=excluded.hoursTracked');
  
  const getModelName = (modelKey: string) => {
    // best-effort name fallback
    return modelKey;
  };

  const tx = db.transaction(() => {
    // apply updates
    for (const u of updates) {
      const intervalKey = u.interval;
      // read existing
      const cur = db.prepare('SELECT meanAbsoluteError, hoursTracked FROM accuracy_scores WHERE locationId = ? AND modelKey = ? AND metricKey = ? AND intervalKey = ?').get(u.locationId, u.modelKey, u.metricKey, intervalKey);
      let newMAE = u.error;
      let newHours = 1;
      if (cur) {
        newMAE = (cur.meanAbsoluteError * cur.hoursTracked + u.error) / (cur.hoursTracked + 1);
        newHours = cur.hoursTracked + 1;
      }
      updStmt.run({ locationId: u.locationId, modelKey: u.modelKey, locationName: u.locationName, modelName: getModelName(u.modelKey), metricKey: u.metricKey, intervalKey, meanAbsoluteError: newMAE, hoursTracked: newHours });
    }

    // delete pending forecasts
    if (idsToDelete.length > 0) {
      const del = db.prepare(`DELETE FROM pending_forecasts WHERE id = ?`);
      for (const id of idsToDelete) del.run(id);
    }

    // add historical
    if (historicalRecordsToAdd.length > 0) {
      for (const r of historicalRecordsToAdd) insertHist.run(r);
    }
  });

  tx();
};

const clearOldData = async (cutoffDate: Date): Promise<void> => {
  if (!db) throw new Error('DB not initialized');
  const iso = cutoffDate.toISOString();
  db.prepare('DELETE FROM pending_forecasts WHERE targetTime <= ?').run(iso);
  db.prepare('DELETE FROM actual_weather WHERE time <= ?').run(iso);
  db.prepare('DELETE FROM historical_forecasts WHERE targetTime <= ?').run(iso);
};

const clearAccuracyData = async (): Promise<void> => {
  if (!db) throw new Error('DB not initialized');
  db.prepare('DELETE FROM accuracy_scores').run();
  db.prepare('DELETE FROM pending_forecasts').run();
  db.prepare('DELETE FROM actual_weather').run();
  db.prepare('DELETE FROM historical_forecasts').run();
};

const getLease = async (id: string): Promise<any> => {
  if (!db) throw new Error('DB not initialized');
  const row = db.prepare('SELECT * FROM leader_lease WHERE id = ?').get(id);
  return row || null;
};

const setLease = async (lease: any): Promise<void> => {
  if (!db) throw new Error('DB not initialized');
  db.prepare('INSERT INTO leader_lease (id, holderId, timestamp) VALUES (@id, @holderId, @timestamp) ON CONFLICT(id) DO UPDATE SET holderId=excluded.holderId, timestamp=excluded.timestamp').run(lease);
};

export {
  initDB,
  areAccuracyStoresEmpty,
  addPendingForecasts,
  addActualWeather,
  getDuePendingForecasts,
  getLatestActualWeatherTime,
  getActualsForLocationAndTimeRange,
  getHistoricalForecasts,
  getAccuracyScores,
  applyAccuracyUpdatesAndDelete,
  clearOldData,
  clearAccuracyData,
  getLease,
  setLease,
};
