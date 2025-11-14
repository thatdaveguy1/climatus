import { AccuracyInterval, AccuracyScore, PendingForecast, ActualWeatherRecord, HistoricalForecastRecord } from '../types.js';
import { MODELS } from '../constants.js';

const DB_NAME = 'ForecastAccuracyDB';
const DB_VERSION = 16;
const PENDING_FORECASTS_STORE = 'pending_forecasts';
const ACCURACY_SCORES_STORE = 'accuracy_scores';
const ACTUAL_WEATHER_STORE = 'actual_weather';
const HISTORICAL_FORECASTS_STORE = 'historical_forecasts';
const LEADER_LEASE_STORE = 'leader_lease';


let db: IDBDatabase;

const createDbError = (rawError: DOMException | null, context: string): Error => {
    // FIX: The `instanceof Error` check was removed. The parameter `rawError` is typed as
    // `DOMException | null`, and this check was causing TypeScript to incorrectly infer the type
    // as `never` because `DOMException` is not an instance of `Error`. This resolves errors
    // related to accessing properties on `rawError`.
    const message = rawError?.message || `IndexedDB ${context} failed with an unknown error.`;
    const error = new Error(message);
    if (rawError?.name) {
        error.name = rawError.name;
    }
    return error;
};

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    console.log(`[DB] Initializing database "${DB_NAME}" version ${DB_VERSION}...`);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject(createDbError(request.error, 'open request'));
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      console.log(`[DB] Database "${DB_NAME}" initialized successfully.`);
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      if (!transaction) {
        console.error("[DB] Upgrade transaction is null. Cannot proceed.");
        return;
      }
      console.log(`[DB] Upgrading database from version ${event.oldVersion} to ${event.newVersion}.`);
      
      // PENDING_FORECASTS_STORE
      if (!dbInstance.objectStoreNames.contains(PENDING_FORECASTS_STORE)) {
          console.log(`[DB] Creating object store: ${PENDING_FORECASTS_STORE}`);
          const pendingStore = dbInstance.createObjectStore(PENDING_FORECASTS_STORE, { keyPath: 'id', autoIncrement: true });
          pendingStore.createIndex('locationTargetTimeIndex', ['locationId', 'targetTime'], { unique: false });
          pendingStore.createIndex('targetTimeIndex', 'targetTime', { unique: false });
      }
      
      // ACCURACY_SCORES_STORE
      if (!dbInstance.objectStoreNames.contains(ACCURACY_SCORES_STORE)) {
          console.log(`[DB] Creating object store: ${ACCURACY_SCORES_STORE}`);
          dbInstance.createObjectStore(ACCURACY_SCORES_STORE, { keyPath: ['locationId', 'modelKey'] });
      }
      
      // ACTUAL_WEATHER_STORE
      if (!dbInstance.objectStoreNames.contains(ACTUAL_WEATHER_STORE)) {
          console.log(`[DB] Creating object store: ${ACTUAL_WEATHER_STORE}`);
          const actualStore = dbInstance.createObjectStore(ACTUAL_WEATHER_STORE, { keyPath: 'id', autoIncrement: true });
          actualStore.createIndex('locationTimeIndex', ['locationId', 'time'], { unique: true });
          actualStore.createIndex('timeIndex', 'time', { unique: false });
      }

      // LEADER_LEASE_STORE
      if (!dbInstance.objectStoreNames.contains(LEADER_LEASE_STORE)) {
          console.log(`[DB] Creating object store: ${LEADER_LEASE_STORE}`);
          dbInstance.createObjectStore(LEADER_LEASE_STORE, { keyPath: 'id' });
      }
      
      // HISTORICAL_FORECASTS_STORE and its new index
      let historicalStore: IDBObjectStore;
      if (!dbInstance.objectStoreNames.contains(HISTORICAL_FORECASTS_STORE)) {
          console.log(`[DB] Creating object store: ${HISTORICAL_FORECASTS_STORE}`);
          historicalStore = dbInstance.createObjectStore(HISTORICAL_FORECASTS_STORE, { keyPath: 'id', autoIncrement: true });
          historicalStore.createIndex('locationTimeIndex', ['locationId', 'targetTime'], { unique: false });
      } else {
          historicalStore = transaction.objectStore(HISTORICAL_FORECASTS_STORE);
      }

      if (!historicalStore.indexNames.contains('targetTimeIndex')) {
          console.log(`[DB] Creating index "targetTimeIndex" on store "${HISTORICAL_FORECASTS_STORE}".`);
          historicalStore.createIndex('targetTimeIndex', 'targetTime', { unique: false });
      }
    };
  });
};

export const areAccuracyStoresEmpty = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PENDING_FORECASTS_STORE, ACTUAL_WEATHER_STORE], 'readonly');
        const pendingStore = transaction.objectStore(PENDING_FORECASTS_STORE);
        const actualStore = transaction.objectStore(ACTUAL_WEATHER_STORE);

        const pendingReq = pendingStore.count();
        const actualReq = actualStore.count();

        transaction.onerror = () => reject(createDbError(transaction.error, 'areAccuracyStoresEmpty transaction'));

        Promise.all([
            new Promise<number>((res, rej) => { pendingReq.onsuccess = () => res(pendingReq.result); pendingReq.onerror = () => rej(createDbError(pendingReq.error, 'pending count request')); }),
            new Promise<number>((res, rej) => { actualReq.onsuccess = () => res(actualReq.result); actualReq.onerror = () => rej(createDbError(actualReq.error, 'actual count request')); })
        ]).then(([pendingCount, actualCount]) => {
            resolve(pendingCount === 0 && actualCount === 0);
        }).catch(reject);
    });
};

export const addPendingForecasts = (forecasts: Omit<PendingForecast, 'id'>[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_FORECASTS_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_FORECASTS_STORE);
    forecasts.forEach(forecast => store.add(forecast));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(createDbError(transaction.error, 'addPendingForecasts transaction'));
  });
};

export const addActualWeather = (record: Omit<ActualWeatherRecord, 'id'>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ACTUAL_WEATHER_STORE], 'readwrite');
    const store = transaction.objectStore(ACTUAL_WEATHER_STORE);
    const index = store.index('locationTimeIndex');
    
    // Check if a record with this location and time already exists to prevent ConstraintError.
    const keyRequest = index.getKey([record.locationId, record.time]);

    keyRequest.onsuccess = () => {
      // If result is undefined, no such record exists, so we can add it.
      if (keyRequest.result === undefined) {
        const addRequest = store.add(record);
        addRequest.onerror = () => console.error('[DB] Failed to add actual weather record:', addRequest.error);
      }
      // If result is not undefined, the record already exists. We do nothing,
      // and the transaction will complete successfully, resolving the promise.
    };
    
    // Let the transaction's handlers resolve/reject the main promise.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(createDbError(transaction.error, 'addActualWeather transaction'));

    // Handle errors only on the initial check request.
    keyRequest.onerror = () => reject(createDbError(keyRequest.error, 'addActualWeather key check request'));
  });
};

export const getDuePendingForecasts = (cutoff: Date): Promise<PendingForecast[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PENDING_FORECASTS_STORE], 'readonly');
        const store = transaction.objectStore(PENDING_FORECASTS_STORE);
        const index = store.index('targetTimeIndex');
        const range = IDBKeyRange.upperBound(cutoff.toISOString());
        const request = index.getAll(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(createDbError(request.error, 'getDuePendingForecasts request'));
    });
};

export const getLatestActualWeatherTime = (locationId: number): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ACTUAL_WEATHER_STORE], 'readonly');
        const store = transaction.objectStore(ACTUAL_WEATHER_STORE);
        const index = store.index('locationTimeIndex');
        const range = IDBKeyRange.bound([locationId, ''], [locationId, '\uffff']);
        const request = index.openCursor(range, 'prev');
        request.onsuccess = () => {
            resolve(request.result ? request.result.value.time : null);
        };
        request.onerror = () => reject(createDbError(request.error, 'getLatestActualWeatherTime request'));
    });
};

export const getActualsForLocationAndTimeRange = (locationId: number, minTime: string, maxTime: string): Promise<ActualWeatherRecord[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ACTUAL_WEATHER_STORE], 'readonly');
        const store = transaction.objectStore(ACTUAL_WEATHER_STORE);
        const index = store.index('locationTimeIndex');
        const range = IDBKeyRange.bound([locationId, minTime], [locationId, maxTime]);
        const request = index.getAll(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(createDbError(request.error, 'getActualsForLocationAndTimeRange request'));
    });
};

export const getHistoricalForecasts = (locationId: number, minTime: string, maxTime: string): Promise<HistoricalForecastRecord[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORICAL_FORECASTS_STORE], 'readonly');
    const store = transaction.objectStore(HISTORICAL_FORECASTS_STORE);
    const index = store.index('locationTimeIndex');
    const range = IDBKeyRange.bound([locationId, minTime], [locationId, maxTime]);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(createDbError(request.error, 'getHistoricalForecasts request'));
  });
};

export const getAccuracyScores = (): Promise<AccuracyScore[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ACCURACY_SCORES_STORE], 'readonly');
    const store = transaction.objectStore(ACCURACY_SCORES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(createDbError(request.error, 'getAccuracyScores request'));
  });
};

export const applyAccuracyUpdatesAndDelete = (
  updates: Array<{ locationId: number; locationName: string; modelKey: string; metricKey: string; error: number; interval: AccuracyInterval }>,
  idsToDelete: number[],
  historicalRecordsToAdd: Omit<HistoricalForecastRecord, 'id'>[]
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ACCURACY_SCORES_STORE, PENDING_FORECASTS_STORE, HISTORICAL_FORECASTS_STORE], 'readwrite');
    const scoresStore = tx.objectStore(ACCURACY_SCORES_STORE);
    const pendingStore = tx.objectStore(PENDING_FORECASTS_STORE);
    const historicalStore = tx.objectStore(HISTORICAL_FORECASTS_STORE);

    tx.onerror = () => reject(createDbError(tx.error, 'applyAccuracyUpdatesAndDelete transaction'));

    const scoreRequests: Promise<AccuracyScore>[] = [];
    const uniqueScores = new Map<string, typeof updates[0]>();
    updates.forEach(u => uniqueScores.set(`${u.locationId}-${u.modelKey}`, u));

    uniqueScores.forEach(u => {
        scoreRequests.push(new Promise((res, rej) => {
            const req = scoresStore.get([u.locationId, u.modelKey]);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(createDbError(req.error, 'get score request in applyAccuracyUpdates'));
        }));
    });

    Promise.all(scoreRequests).then(existingScores => {
        const scoreMap = new Map<string, AccuracyScore>();
        existingScores.forEach(s => {
            if (s) scoreMap.set(`${s.locationId}-${s.modelKey}`, s);
        });

        updates.forEach(update => {
            const key = `${update.locationId}-${update.modelKey}`;
            let score = scoreMap.get(key);
            if (!score) {
                const model = MODELS.find(m => m.key === update.modelKey);
                score = {
                    locationId: update.locationId,
                    locationName: update.locationName,
                    modelKey: update.modelKey,
                    modelName: model?.name || update.modelKey,
                    scores: {},
                };
            }
            if (!score.scores[update.metricKey]) {
                score.scores[update.metricKey] = {
                    '24h': { meanAbsoluteError: 0, hoursTracked: 0 },
                    '48h': { meanAbsoluteError: 0, hoursTracked: 0 },
                    '5d': { meanAbsoluteError: 0, hoursTracked: 0 },
                };
            }

            const currentData = score.scores[update.metricKey][update.interval];
            const newTotalError = currentData.meanAbsoluteError * currentData.hoursTracked + update.error;
            const newHoursTracked = currentData.hoursTracked + 1;
            currentData.meanAbsoluteError = newTotalError / newHoursTracked;
            currentData.hoursTracked = newHoursTracked;
            
            scoreMap.set(key, score);
        });

        scoreMap.forEach(score => scoresStore.put(score));
        idsToDelete.forEach(id => pendingStore.delete(id));
        historicalRecordsToAdd.forEach(record => historicalStore.add(record));
    }).catch(reject);

    tx.oncomplete = () => resolve();
  });
};

export const clearOldData = (cutoffDate: Date): Promise<void> => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([PENDING_FORECASTS_STORE, ACTUAL_WEATHER_STORE, HISTORICAL_FORECASTS_STORE], 'readwrite');
        const stores = {
            pending: tx.objectStore(PENDING_FORECASTS_STORE).index('targetTimeIndex'),
            actual: tx.objectStore(ACTUAL_WEATHER_STORE).index('timeIndex'),
            historical: tx.objectStore(HISTORICAL_FORECASTS_STORE).index('targetTimeIndex'),
        };
        const range = IDBKeyRange.upperBound(cutoffDate.toISOString());

        Object.values(stores).forEach(index => {
            index.openKeyCursor(range).onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
                if (cursor) {
                    index.objectStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };
        });
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(createDbError(tx.error, 'clearOldData transaction'));
    });
};

export const clearAccuracyData = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([ACCURACY_SCORES_STORE, PENDING_FORECASTS_STORE, ACTUAL_WEATHER_STORE, HISTORICAL_FORECASTS_STORE], 'readwrite');
        tx.objectStore(ACCURACY_SCORES_STORE).clear();
        tx.objectStore(PENDING_FORECASTS_STORE).clear();
        tx.objectStore(ACTUAL_WEATHER_STORE).clear();
        tx.objectStore(HISTORICAL_FORECASTS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(createDbError(tx.error, 'clearAccuracyData transaction'));
    });
};

export const getLease = (id: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("Database not initialized for getLease"));
        const transaction = db.transaction(LEADER_LEASE_STORE, 'readonly');
        const request = transaction.objectStore(LEADER_LEASE_STORE).get(id);
        
        transaction.onerror = () => reject(createDbError(transaction.error, 'getLease transaction'));
        request.onsuccess = e => resolve((e.target as IDBRequest).result);
        request.onerror = () => reject(createDbError(request.error, 'getLease request'));
    });
};

export const setLease = (lease: any): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("Database not initialized for setLease"));
        const tx = db.transaction(LEADER_LEASE_STORE, 'readwrite');
        tx.objectStore(LEADER_LEASE_STORE).put(lease);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(createDbError(tx.error, 'setLease transaction'));
    });
};