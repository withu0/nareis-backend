/**
 * Database Initialization Script
 * 
 * This script initializes the local MongoDB database by:
 * 1. Connecting to MongoDB
 * 2. Loading all models to register schemas
 * 3. Ensuring all indexes are created
 * 4. Verifying the setup
 * 
 * Run this script after setting up MongoDB on your VPS:
 * npm run init-db
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import all models to register their schemas and indexes
import '../models/User.js';
import '../models/Event.js';
import '../models/EventRegistration.js';
import '../models/EventWaitlist.js';
import '../models/EventFeedback.js';
import '../models/PaymentHistory.js';

dotenv.config();

const initDatabase = async () => {
  try {
    console.log('🚀 Starting database initialization...\n');

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    // Get database instance
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database instance not available');
    }

    console.log('📋 Registering models and creating indexes...\n');

    // Get all registered models
    const models = mongoose.modelNames();
    console.log(`📦 Found ${models.length} registered models:`);
    models.forEach((modelName) => {
      console.log(`   - ${modelName}`);
    });

    console.log('\n🔍 Creating indexes for all collections...');

    // Ensure indexes are created for all models
    // Mongoose will create indexes defined in schemas
    for (const modelName of models) {
      const model = mongoose.model(modelName);
      try {
        await model.createIndexes();
        console.log(`   ✅ Indexes created for ${modelName}`);
      } catch (error: any) {
        console.error(`   ⚠️  Error creating indexes for ${modelName}:`, error.message);
      }
    }

    console.log('\n📊 Database Collections:');
    const collections = await db.listCollections().toArray();
    if (collections.length === 0) {
      console.log('   ℹ️  No collections found (this is normal for a new database)');
    } else {
      collections.forEach((collection) => {
        console.log(`   - ${collection.name}`);
      });
    }

    console.log('\n✅ Database initialization completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Your database is ready to use');
    console.log('   2. Start your application with: npm run dev or npm start');
    console.log('   3. Collections and indexes will be created automatically when you create documents');

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
};

// Run initialization
initDatabase();
