import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST before any other imports
// Use explicit path to .env file in project root (two levels up from src/index.ts)
const envPath = path.join(__dirname, '../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn(`⚠️  Warning: Could not load .env file from ${envPath}:`, result.error.message);
} else {
  console.log(`✅ Loaded .env file from: ${envPath}`);
}

import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import stripeRoutes from './routes/stripe.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import eventsRoutes from './routes/events.js';
import statisticsRoutes from './routes/statistics.js';

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook needs raw body - apply JSON parsing to all routes EXCEPT webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../public')));
app.use('/uploads/avatars', express.static(path.join(__dirname, '../public/avatars')));
app.use('/uploads/events', express.static(path.join(__dirname, '../public/events')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.2' 
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/statistics', statisticsRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    const server = app.listen(PORT, () => {
      console.log(`=? Server running on port ${PORT}`);
      console.log(`=? API available at http://localhost:${PORT}/api`);
      console.log(`=? Stripe Price IDs loaded:`, {
        foundation: process.env.STRIPE_PRICE_ID_FOUNDATION ? '' : '',
        growth: process.env.STRIPE_PRICE_ID_GROWTH ? '' : '',
        stakeholder: process.env.STRIPE_PRICE_ID_STAKEHOLDER ? '' : '',
        professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL ? '' : '',
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ? '' : '',
        founding: process.env.STRIPE_PRICE_ID_FOUNDING ? '' : '',
      });
    });

    // Handle server errors (e.g., port already in use)
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`   Please either:`);
        console.error(`   1. Stop the process using port ${PORT}`);
        console.error(`   2. Use a different port by setting the PORT environment variable`);
        console.error(`\n   To find and kill the process on Windows:`);
        console.error(`   netstat -ano | findstr :${PORT}`);
        console.error(`   taskkill /PID <PID> /F`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
