import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'url';

// Import route handlers
import weatherRoutes from './routes/weather.js';
import aiRoutes from './routes/ai.js';
import accuracyRoutes from './routes/accuracy.js';

// Import data collection service
import { dataCollectionService } from './services/dataCollectionService.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 12000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://aistudiocdn.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.open-meteo.com", "https://geocoding-api.open-meteo.com", "https://aistudiocdn.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API caching for GET requests (suitable for 30-minute cron-backed endpoints)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    // Allow clients to cache API GET responses for 30 minutes
    res.setHeader('Cache-Control', 'public, max-age=1800');
  }
  next();
});

// API routes
app.use('/api/weather', weatherRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/accuracy', accuracyRoutes);

// Data collection service status endpoint
app.get('/api/data-collection/status', (req, res) => {
  const status = dataCollectionService.getStatus();
  res.json(status);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// TypeScript compilation middleware (development-only)
if (process.env.NODE_ENV !== 'production') {
  app.get('*.tsx', async (req, res, next) => {
    try {
      const filePath = path.join(__dirname, '../../', req.path);
      
      if (!fs.existsSync(filePath)) {
        return next();
      }

      const result = await build({
        entryPoints: [filePath],
        bundle: true,
        format: 'esm',
        target: 'es2020',
        jsx: 'automatic',
        write: false,
        external: ['react', 'react-dom', 'recharts', '@google/genai'],
        loader: {
          '.tsx': 'tsx',
          '.ts': 'ts'
        }
      });

      res.setHeader('Content-Type', 'application/javascript');
      res.send(result.outputFiles[0].text);
    } catch (error) {
      console.error('TypeScript compilation error:', error);
      next(error);
    }
  });
}

// Serve prebuilt client bundle from /public (dist/public) with long cache when available
const publicDir = path.join(__dirname, '../../dist/public');
let clientBundleFile = 'app.js';
if (fs.existsSync(publicDir)) {
  // Find a content-hashed bundle (e.g. app.abcdef12.js) if present
  try {
    const files = fs.readdirSync(publicDir);
    const hashed = files.find(f => /^app\.[a-f0-9]{6,}\.js$/.test(f));
    if (hashed) clientBundleFile = hashed;
  } catch (e) {
    console.warn('Unable to scan publicDir for bundles', e);
  }

  app.use('/public', express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        // App bundle: long-lived and immutable
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
} else {
  // Fallback for development when dist/public isn't populated
  app.use('/public', express.static(path.join(__dirname, '../../public'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));
}

// Serve static files from the React app root (for importmap-based loading)
app.use(express.static(path.join(__dirname, '../../'), {
  setHeaders: (res, filePath) => {
    // Set proper MIME types for TypeScript files
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Catch all handler: send back React's index.html file for client-side routing
// This should be LAST, after all API routes and static files
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../index.html');
  if (fs.existsSync(publicDir) && fs.existsSync(indexPath)) {
    // Read index.html and rewrite the client bundle path to include the content-hash
    try {
      let html = fs.readFileSync(indexPath, 'utf8');
      // Replace /public/app.js with the hashed filename when available
      html = html.replace('/public/app.js', `/public/${clientBundleFile}`);
      // Ensure the HTML is not aggressively cached so clients fetch new index.html when deploys happen
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) {
      console.error('Error reading or sending index.html', err);
      return res.status(500).send('Internal server error');
    }
  }

  // Fallback - serve the raw index.html from repo root
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🌤️  Climatus server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Access URL: http://localhost:${PORT}`);
  
  // Start data collection service
  console.log('🔄 Starting data collection service...');
  dataCollectionService.start();
});

export default app;