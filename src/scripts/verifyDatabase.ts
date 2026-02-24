/**
 * Database Verification Script
 * 
 * This script verifies that:
 * 1. MongoDB connection is working
 * 2. All required models are registered
 * 3. All collections exist (or will be created on first use)
 * 4. Indexes are properly configured
 * 
 * Run this script to verify your database setup:
 * npm run verify-db
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import all models to register their schemas
import '../models/User.js';
import '../models/Event.js';
import '../models/EventRegistration.js';
import '../models/EventWaitlist.js';
import '../models/EventFeedback.js';
import '../models/PaymentHistory.js';

dotenv.config();

const verifyDatabase = async () => {
  try {
    console.log('🔍 Verifying database setup...\n');

    // Check environment variable
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    console.log('✅ MONGODB_URI is set');

    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    // Get database instance
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database instance not available');
    }

    const dbName = db.databaseName;
    console.log(`📊 Database: ${dbName}\n`);

    // Check registered models
    const models = mongoose.modelNames();
    const requiredModels = [
      'User',
      'Event',
      'EventRegistration',
      'EventWaitlist',
      'EventFeedback',
      'PaymentHistory',
    ];

    console.log('📦 Checking models:');
    let allModelsPresent = true;
    for (const requiredModel of requiredModels) {
      if (models.includes(requiredModel)) {
        console.log(`   ✅ ${requiredModel} - registered`);
      } else {
        console.log(`   ❌ ${requiredModel} - missing`);
        allModelsPresent = false;
      }
    }

    if (!allModelsPresent) {
      throw new Error('Some required models are not registered');
    }

    // Check collections
    console.log('\n📚 Checking collections:');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    const expectedCollections = [
      'users',
      'events',
      'eventregistrations',
      'eventwaitlists',
      'eventfeedbacks',
      'paymenthistories',
    ];

    for (const expectedCollection of expectedCollections) {
      if (collectionNames.includes(expectedCollection)) {
        const collection = db.collection(expectedCollection);
        const count = await collection.countDocuments();
        console.log(`   ✅ ${expectedCollection} - exists (${count} documents)`);
      } else {
        console.log(`   ℹ️  ${expectedCollection} - will be created on first use`);
      }
    }

    // Check indexes for existing collections
    if (collections.length > 0) {
      console.log('\n🔍 Checking indexes:');
      for (const collection of collections) {
        const collectionObj = db.collection(collection.name);
        const indexes = await collectionObj.indexes();
        console.log(`   📋 ${collection.name}: ${indexes.length} index(es)`);
        indexes.forEach((index) => {
          const keys = Object.keys(index.key).join(', ');
          console.log(`      - ${index.name} on (${keys})`);
        });
      }
    } else {
      console.log('\nℹ️  No collections found yet. Indexes will be created when collections are first used.');
    }

    // Test database operations
    console.log('\n🧪 Testing database operations...');
    const testResult = await db.admin().ping();
    if (testResult.ok === 1) {
      console.log('   ✅ Database ping successful');
    } else {
      throw new Error('Database ping failed');
    }

    console.log('\n✅ Database verification completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Database: ${dbName}`);
    console.log(`   - Models registered: ${models.length}`);
    console.log(`   - Collections: ${collections.length}`);
    console.log(`   - Status: Ready to use`);

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Database verification failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure MongoDB is running: sudo systemctl status mongod');
    console.error('   2. Check MONGODB_URI in your .env file');
    console.error('   3. Verify MongoDB connection string format');
    console.error('   4. Check MongoDB logs: sudo journalctl -u mongod -n 50');
    process.exit(1);
  }
};

// Run verification
verifyDatabase();
