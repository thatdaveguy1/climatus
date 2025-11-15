import express from 'express';
import { fetchForecasts, searchLocations, fetchCurrentWeather, fetchPastWeather } from '../services/openMeteoService.js';

const router = express.Router();

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

    const result = await fetchForecasts(type as 'hourly' | 'daily', lat, lon);
    res.json(result);
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

    const result = await fetchCurrentWeather(lat, lon);
    res.json(result);
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