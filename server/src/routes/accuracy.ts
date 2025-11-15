import express from 'express';
import { checkAndRunHourlyUpdate, runFullAccuracyCycleNow } from '../services/accuracyService.js';
import { getLease } from '../services/sqliteDbService.js';

const router = express.Router();

// Trigger hourly accuracy update
router.post('/update', async (req, res) => {
  try {
    await checkAndRunHourlyUpdate();
    res.json({ 
      status: 'success',
      message: 'Accuracy update completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running accuracy update:', error);
    res.status(500).json({ 
      error: 'Failed to run accuracy update',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger full accuracy cycle
router.post('/full-cycle', async (req, res) => {
  try {
    await runFullAccuracyCycleNow();
    res.json({ 
      status: 'success',
      message: 'Full accuracy cycle completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running full accuracy cycle:', error);
    res.status(500).json({ 
      error: 'Failed to run full accuracy cycle',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get accuracy status
router.get('/status', async (req, res) => {
  const lastCheckString = process.env.LAST_ACCURACY_CHECK || '';
  const lastCheckTime = lastCheckString ? parseInt(lastCheckString, 10) : 0;
  const now = Date.now();
  const oneHour = 3600 * 1000;
  const timeSinceLastCheck = now - lastCheckTime;
  
  res.json({
    lastCheck: lastCheckTime ? new Date(lastCheckTime).toISOString() : null,
    timeSinceLastCheck,
    shouldRunCheck: !lastCheckString || isNaN(lastCheckTime) || timeSinceLastCheck > oneHour,
    nextCheckIn: Math.max(0, oneHour - timeSinceLastCheck),
    timestamp: new Date().toISOString()
  });
});

export default router;