import { fetchCurrentWeather, fetchPastWeather, fetchForecasts } from './openMeteoService.js';
import fs from 'fs';
import path from 'path';

import { checkAndRunHourlyUpdate } from './accuracyService.js';

// Fixed locations for data collection (same as accuracy tracking locations)
const COLLECTION_LOCATIONS = [
  { name: '37 Jubilation', latitude: 53.6, longitude: -113.6 },
  { name: '66 Aspenglen Cres', latitude: 53.63, longitude: -113.63 },
  { name: 'Edmonton Airport CYEG', latitude: 53.3097, longitude: -113.5803 },
  { name: 'Villeneuve Airport CZVL', latitude: 53.8333, longitude: -113.35 }
];

const CACHE_DIR = process.env.SERVER_CACHE_DIR ? path.resolve(process.env.SERVER_CACHE_DIR) : path.resolve(__dirname, '..', '..', 'data', 'cache');
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
};
const safeWriteJson = (filePath: string, obj: any) => {
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.warn('[DataCollection] Failed to write cache file', filePath, err);
  }
};
const coordKey = (lat: number, lon: number) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

class DataCollectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the data collection service
   */
  start(): void {
    if (this.isRunning) {
      console.log('[DataCollection] Service already running');
      return;
    }

    console.log('[DataCollection] Starting data collection service (30-minute intervals)');
    this.isRunning = true;

    // Run immediately on start
    this.collectData();

    // Then run every 30 minutes
    this.intervalId = setInterval(() => {
      this.collectData();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
  }

  /**
   * Stop the data collection service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[DataCollection] Data collection service stopped');
  }

  /**
   * Collect weather data for all locations
   */
  private async collectData(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[DataCollection] Starting data collection cycle at ${timestamp}`);

    try {
      // Ensure cache dir
      ensureCacheDir();

      // Collect data for each location
      for (const location of COLLECTION_LOCATIONS) {
        await this.collectLocationData(location);
      }

      // Run accuracy update check
      console.log('[DataCollection] Running accuracy update check...');
      await checkAndRunHourlyUpdate();

      console.log('[DataCollection] Data collection cycle completed successfully');
    } catch (error) {
      console.error('[DataCollection] Error during data collection cycle:', error);
    }
  }

  /**
   * Collect data for a specific location
   */
  private async collectLocationData(location: { name: string; latitude: number; longitude: number }): Promise<void> {
    try {
      console.log(`[DataCollection] Collecting data for ${location.name}...`);

      // Fetch current weather
      const current = await fetchCurrentWeather(location.latitude, location.longitude);

      // Fetch past weather (for accuracy comparison) - last 2 days
      const past = await fetchPastWeather(location.latitude, location.longitude, 2);

      // Fetch forecasts for accuracy tracking
      const hourly = await fetchForecasts('hourly', location.latitude, location.longitude);
      const daily = await fetchForecasts('daily', location.latitude, location.longitude);

      // Persist quick caches to disk
      try {
        const key = slug(location.name);
        safeWriteJson(path.join(CACHE_DIR, `${key}.current.json`), { fetchedAt: new Date().toISOString(), data: current });
        safeWriteJson(path.join(CACHE_DIR, `${key}.past.json`), { fetchedAt: new Date().toISOString(), data: past });
        safeWriteJson(path.join(CACHE_DIR, `${key}.hourly.json`), { fetchedAt: new Date().toISOString(), data: hourly });
        safeWriteJson(path.join(CACHE_DIR, `${key}.daily.json`), { fetchedAt: new Date().toISOString(), data: daily });
      } catch (err) {
        console.warn('[DataCollection] Failed to persist quick cache files for', location.name, err);
      }

      console.log(`[DataCollection] Successfully collected data for ${location.name}`);
    } catch (error) {
      console.error(`[DataCollection] Error collecting data for ${location.name}:`, error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; nextCollection?: string } {
    const status = { isRunning: this.isRunning };
    
    if (this.isRunning) {
      // Calculate next collection time (30 minutes from now)
      const nextCollection = new Date();
      nextCollection.setMinutes(nextCollection.getMinutes() + 30);
      return {
        ...status,
        nextCollection: nextCollection.toISOString()
      };
    }
    
    return status;
  }
}

// Export singleton instance
export const dataCollectionService = new DataCollectionService();