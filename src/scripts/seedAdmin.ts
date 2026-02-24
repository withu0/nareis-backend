/**
 * Admin User Seed Script
 * 
 * This script creates an admin user in the database with:
 * - Admin role
 * - Active membership status
 * - Approved status
 * - Email verified
 * 
 * Run this script to create an admin user:
 * npm run seed-admin
 * 
 * You can customize the admin user by setting environment variables:
 * - ADMIN_EMAIL (default: admin@gmail.com)
 * - ADMIN_PASSWORD (default: password)
 * - ADMIN_NAME (default: Admin User)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    console.log('🚀 Starting admin user seed...\n');

    // Get configuration from environment variables or use defaults
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';
    const adminName = process.env.ADMIN_NAME || 'Admin User';

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`⚠️  Admin user already exists with email: ${adminEmail}`);
        console.log(`   User ID: ${existingAdmin._id}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Status: ${existingAdmin.membershipStatus}`);
        console.log('\n✅ Admin user is already configured.');
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
      } else {
        console.log(`⚠️  User exists with email: ${adminEmail} but is not an admin.`);
        console.log('   Updating user to admin role...');
        existingAdmin.role = 'admin';
        existingAdmin.membershipStatus = 'active';
        existingAdmin.approvalStatus = 'approved';
        existingAdmin.emailVerified = true;
        existingAdmin.onboardingCompleted = true;
        
        // Set membership expiration to 1 year from now
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        existingAdmin.membershipExpiresAt = expirationDate;
        
        await existingAdmin.save();
        console.log('✅ User updated to admin successfully!');
        console.log(`   User ID: ${existingAdmin._id}`);
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Membership Status: ${existingAdmin.membershipStatus}`);
        console.log(`   Approval Status: ${existingAdmin.approvalStatus}`);
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
      }
    }

    // Split full name into first and last name
    const nameParts = adminName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create admin user
    console.log('👤 Creating admin user...');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Name: ${adminName}`);
    console.log(`   Password: ${'*'.repeat(adminPassword.length)}`);

    const adminUser = new User({
      email: adminEmail.toLowerCase(),
      password: adminPassword, // Will be hashed by pre-save hook
      fullName: adminName,
      firstName,
      lastName,
      role: 'admin',
      emailVerified: true,
      membershipStatus: 'active',
      approvalStatus: 'approved',
      onboardingCompleted: true,
      membershipTier: 'enterprise', // Set a premium tier for admin
    });

    // Set membership expiration to 1 year from now
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    adminUser.membershipExpiresAt = expirationDate;

    await adminUser.save();

    console.log('\n✅ Admin user created successfully!');
    console.log(`   User ID: ${adminUser._id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Full Name: ${adminUser.fullName}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Membership Status: ${adminUser.membershipStatus}`);
    console.log(`   Approval Status: ${adminUser.approvalStatus}`);
    console.log(`   Email Verified: ${adminUser.emailVerified}`);
    console.log(`   Membership Tier: ${adminUser.membershipTier}`);
    console.log(`   Membership Expires: ${adminUser.membershipExpiresAt?.toLocaleDateString()}`);

    console.log('\n📝 Next steps:');
    console.log('   1. Login with the admin credentials:');
    console.log(`      Email: ${adminEmail}`);
    console.log(`      Password: ${adminPassword}`);
    console.log('   2. You can now create events and access admin features');
    console.log('   3. Consider changing the password after first login');

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Admin user seed failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    if (error.code === 11000) {
      console.error('\n💡 This error usually means a user with this email already exists.');
      console.error('   The script will update existing users to admin if they exist.');
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

// Run seed
seedAdmin();
