import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import stripeRoutes from './routes/stripe.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import eventsRoutes from './routes/events.js';

const app = express();
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventsRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`💳 Stripe Price IDs loaded:`, {
        foundation: process.env.STRIPE_PRICE_ID_FOUNDATION ? '✓' : '✗',
        growth: process.env.STRIPE_PRICE_ID_GROWTH ? '✓' : '✗',
        stakeholder: process.env.STRIPE_PRICE_ID_STAKEHOLDER ? '✓' : '✗',
        professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL ? '✓' : '✗',
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ? '✓' : '✗',
        founding: process.env.STRIPE_PRICE_ID_FOUNDING ? '✓' : '✗',
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
