import express from 'express';
import { generateForecastSummary } from '../services/geminiService.js';
import { ProcessedForecasts, ForecastView, Location } from '../types.js';

const router = express.Router();

// Generate AI forecast summary
router.post('/summary', async (req, res) => {
  try {
    const { forecasts, view, location } = req.body;

    if (!forecasts || !view || !location) {
      return res.status(400).json({ 
        error: 'Missing required fields: forecasts, view, and location are required' 
      });
    }

    if (view !== 'hourly' && view !== 'daily') {
      return res.status(400).json({ 
        error: 'View must be either "hourly" or "daily"' 
      });
    }

    // Validate location object
    if (!location.name || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ 
        error: 'Location must have name, latitude, and longitude properties' 
      });
    }

    const summary = await generateForecastSummary(
      forecasts as ProcessedForecasts,
      view as ForecastView,
      location as Location
    );

    res.json({ summary });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate AI summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for AI service
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  res.json({ 
    status: hasApiKey ? 'ready' : 'no_api_key',
    hasApiKey,
    timestamp: new Date().toISOString()
  });
});

export default router;