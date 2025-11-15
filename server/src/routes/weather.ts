import express from 'express';
import { fetchForecasts, searchLocations, fetchCurrentWeather, fetchPastWeather } from '../services/openMeteoService.js';
import fs from 'fs';
import path from 'path';
import { ACCURACY_LOCATIONS } from '../constants.js';

const router = express.Router();

const CACHE_DIR = path.resolve(process.cwd(), 'server', 'data', 'cache');
const readCache = (filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[API] Failed to read cache file', filePath, err);
    return null;
  }
};
const coordKey = (lat: number, lon: number) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;

// Get forecasts (hourly or daily)
router.get('/forecasts/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (type !== 'hourly' && type !== 'daily') {
      return res.status(400).json({ error: 'Type must be either "hourly" or "daily"' });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    // Attempt to serve from disk cache for known collection locations
    const matched = ACCURACY_LOCATIONS.find(l => Math.abs(l.latitude - lat) < 0.02 && Math.abs(l.longitude - lon) < 0.02);
    if (matched) {
      const key = matched.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filePath = path.join(CACHE_DIR, `${key}.${type}.json`);
      const cached = readCache(filePath);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    }

    // If no cache available, optionally allow a live fetch (controlled by env)
    if (process.env.SERVER_ALLOW_LIVE_FETCH_ON_MISS === 'true') {
      const live = await fetchForecasts(type as 'hourly' | 'daily', lat, lon);
      // persist to cache if matched a known location
      if (matched) {
        try {
          const key = matched.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const filePath = path.join(CACHE_DIR, `${key}.${type}.json`);
          fs.mkdirSync(CACHE_DIR, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify({ fetchedAt: new Date().toISOString(), data: live }), 'utf8');
        } catch (err) {
          console.warn('[API] Failed to persist live forecast to cache', err);
        }
      }
      res.setHeader('X-Cache', 'MISS');
      return res.json({ fetchedAt: new Date().toISOString(), data: live });
    }

    return res.status(503).json({ error: 'No cached forecast available for requested location' });
  } catch (error) {
    console.error('Error fetching forecasts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch forecasts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search locations
router.get('/locations/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    if (q.trim().length < 3) {
      return res.status(400).json({ error: 'Search query must be at least 3 characters long' });
    }

    const results = await searchLocations(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching locations:', error);
    res.status(500).json({ 
      error: 'Failed to search locations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current weather
router.get('/current', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    // Serve from disk cache for known collection locations
    const matched = ACCURACY_LOCATIONS.find(l => Math.abs(l.latitude - lat) < 0.02 && Math.abs(l.longitude - lon) < 0.02);
    if (matched) {
      const key = matched.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filePath = path.join(CACHE_DIR, `${key}.current.json`);
      const cached = readCache(filePath);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    }

    if (process.env.SERVER_ALLOW_LIVE_FETCH_ON_MISS === 'true') {
      const live = await fetchCurrentWeather(lat, lon);
      if (matched) {
        try {
          const key = matched.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const filePath = path.join(CACHE_DIR, `${key}.current.json`);
          fs.mkdirSync(CACHE_DIR, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify({ fetchedAt: new Date().toISOString(), data: live }), 'utf8');
        } catch (err) {
          console.warn('[API] Failed to persist live current to cache', err);
        }
      }
      res.setHeader('X-Cache', 'MISS');
      return res.json({ fetchedAt: new Date().toISOString(), data: live });
    }

    return res.status(503).json({ error: 'No cached current weather available for requested location' });
  } catch (error) {
    console.error('Error fetching current weather:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current weather',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get past weather
router.get('/past', async (req, res) => {
  try {
    const { latitude, longitude, days } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);
    const numDays = days ? parseInt(days as string) : 1;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude values' });
    }

    if (isNaN(numDays) || numDays < 1 || numDays > 7) {
      return res.status(400).json({ error: 'Days must be a number between 1 and 7' });
    }

    const result = await fetchPastWeather(lat, lon, numDays);
    res.json(result);
  } catch (error) {
    console.error('Error fetching past weather:', error);
    res.status(500).json({ 
      error: 'Failed to fetch past weather',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;