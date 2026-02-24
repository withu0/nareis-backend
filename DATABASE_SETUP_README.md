# Database Setup for VPS Deployment

This document explains the database setup files and scripts created for deploying NAREIS on a VPS with local MongoDB.

## 📁 Files Created

### 1. **MONGODB_VPS_SETUP.md**
   Complete guide for installing and configuring MongoDB on your VPS. Includes:
   - Installation instructions for Ubuntu/Debian and CentOS/RHEL
   - Security configuration
   - User creation
   - Troubleshooting tips

### 2. **QUICK_START_VPS.md**
   Quick reference guide with essential commands for fast setup.

### 3. **src/scripts/initDatabase.ts**
   Database initialization script that:
   - Connects to MongoDB
   - Loads all models (User, Event, EventRegistration, EventWaitlist, EventFeedback, PaymentHistory)
   - Creates all indexes defined in your schemas
   - Verifies the setup

### 4. **src/scripts/verifyDatabase.ts**
   Database verification script that:
   - Tests MongoDB connection
   - Verifies all models are registered
   - Checks collections and indexes
   - Provides detailed status report

## 🚀 Quick Setup Steps

### On Your VPS:

1. **Install MongoDB** (see MONGODB_VPS_SETUP.md for details)
   ```bash
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

2. **Configure your `.env` file:**
   ```env
   MONGODB_URI=mongodb://localhost:27017/nareis
   ```

3. **Initialize the database:**
   ```bash
   cd nareis-backend
   npm install
   npm run build
   npm run init-db
   ```

4. **Verify setup:**
   ```bash
   npm run verify-db
   ```

5. **Start your application:**
   ```bash
   npm start
   ```

## 📋 Available NPM Scripts

- `npm run init-db` - Initialize database and create indexes
- `npm run verify-db` - Verify database setup and connection

## 🗄️ Database Collections

The following collections will be created automatically when you start using the application:

1. **users** - User accounts, profiles, and authentication
2. **events** - Event information and details
3. **eventregistrations** - Event registration records
4. **eventwaitlists** - Waitlist entries for events
5. **eventfeedbacks** - Event feedback and ratings
6. **paymenthistories** - Payment transaction history

All indexes defined in your Mongoose models will be created automatically.

## 🔒 Security Recommendations

1. **Enable MongoDB Authentication** (recommended for production)
   - Create admin user
   - Create application-specific user
   - Update MONGODB_URI with credentials

2. **Bind to localhost only**
   - MongoDB should only accept local connections
   - Use SSH tunneling if remote access is needed

3. **Use strong passwords**
   - Generate secure passwords for database users
   - Store credentials securely in `.env` file

4. **Regular backups**
   - Set up automated backups
   - Test restore procedures

## 🔍 Troubleshooting

### MongoDB won't start
```bash
sudo journalctl -u mongod -n 50
```

### Connection refused
- Check if MongoDB is running: `sudo systemctl status mongod`
- Verify connection string in `.env`
- Check firewall settings

### Authentication errors
- Verify username and password
- Check `authSource` in connection string
- Ensure user has correct roles

For more troubleshooting tips, see [MONGODB_VPS_SETUP.md](./MONGODB_VPS_SETUP.md).

## 📚 Additional Resources

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- Full setup guide: [MONGODB_VPS_SETUP.md](./MONGODB_VPS_SETUP.md)
- Quick reference: [QUICK_START_VPS.md](./QUICK_START_VPS.md)

## ✅ Verification Checklist

Before deploying to production, ensure:

- [ ] MongoDB is installed and running
- [ ] MongoDB starts on boot (`systemctl enable mongod`)
- [ ] Database initialization completed successfully
- [ ] All models are registered (verify with `npm run verify-db`)
- [ ] Connection string is correct in `.env`
- [ ] Authentication is enabled (if using)
- [ ] Firewall is configured properly
- [ ] Backups are configured
- [ ] Application connects successfully

---

**Note:** The database schema is automatically created from your Mongoose models. You don't need to manually create collections or indexes - they will be created when first used.
