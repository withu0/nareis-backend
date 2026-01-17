# MongoDB Setup Guide

This guide will help you set up MongoDB for the NAREIS backend.

## Option 1: MongoDB Atlas (Cloud - Recommended for Development)

MongoDB Atlas is free and doesn't require local installation.

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for a free account
3. Create a new organization (or use default)
4. Create a new project (or use default)

### Step 2: Create a Cluster
1. Click "Build a Database"
2. Choose "M0 FREE" (Free tier)
3. Select a cloud provider and region (choose closest to you)
4. Click "Create"
5. Wait 3-5 minutes for cluster to be created

### Step 3: Create Database User
1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter username (e.g., `nareis_admin`)
5. Enter password (save it securely!)
6. Set privileges to "Atlas admin" or "Read and write to any database"
7. Click "Add User"

### Step 4: Whitelist Your IP Address
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development) or add your specific IP
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Database" in left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string (looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
5. Replace `<username>` and `<password>` with your database user credentials
6. Add database name at the end: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nareis?retryWrites=true&w=majority`

### Step 6: Update .env File
Create `backend/.env` file with:
```
MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/nareis?retryWrites=true&w=majority
```

---

## Option 2: Local MongoDB Installation

### Windows Installation

1. **Download MongoDB Community Server**
   - Go to https://www.mongodb.com/try/download/community
   - Select: Version (latest), Platform (Windows), Package (MSI)
   - Click "Download"

2. **Install MongoDB**
   - Run the downloaded .msi file
   - Choose "Complete" installation
   - Check "Install MongoDB as a Service"
   - Check "Run service as Network Service user"
   - Check "Install MongoDB Compass" (GUI tool)
   - Click "Install"

3. **Verify Installation**
   - Open Command Prompt or PowerShell
   - Run: `mongod --version`
   - Should show MongoDB version

4. **Start MongoDB Service**
   - MongoDB should start automatically as a Windows service
   - To verify, open Services (Win+R, type `services.msc`)
   - Look for "MongoDB" service - should be "Running"

5. **Test Connection**
   - Open Command Prompt
   - Run: `mongosh` (or `mongo` for older versions)
   - Should connect to local MongoDB instance

6. **Update .env File**
   Create `backend/.env` file with:
   ```
   MONGODB_URI=mongodb://localhost:27017/nareis
   ```

### macOS Installation

1. **Install using Homebrew**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB**
   ```bash
   brew services start mongodb-community
   ```

3. **Verify Installation**
   ```bash
   mongosh
   ```

4. **Update .env File**
   Create `backend/.env` file with:
   ```
   MONGODB_URI=mongodb://localhost:27017/nareis
   ```

### Linux Installation

1. **Install MongoDB**
   ```bash
   # For Ubuntu/Debian
   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   ```

2. **Start MongoDB**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Verify Installation**
   ```bash
   mongosh
   ```

4. **Update .env File**
   Create `backend/.env` file with:
   ```
   MONGODB_URI=mongodb://localhost:27017/nareis
   ```

---

## Complete Backend Setup

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Create .env File
Copy `.env.example` to `.env` and fill in your values:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

### Step 3: Edit .env File
Open `backend/.env` and update:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nareis
# OR for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nareis?retryWrites=true&w=majority

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:5173
```

**Important Notes:**
- Generate a strong JWT_SECRET (you can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- For Stripe, get keys from https://dashboard.stripe.com/test/apikeys
- For email, use Gmail App Password (not regular password)

### Step 4: Test Database Connection
```bash
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📡 API available at http://localhost:5000/api
```

If you see connection errors, check:
- MongoDB is running (for local installation)
- Connection string is correct
- IP is whitelisted (for Atlas)
- Username/password are correct

### Step 5: Verify Database Creation
The database and collections will be created automatically when you:
1. Start the server
2. Make your first API call (signup/login)

You can verify using:
- **MongoDB Compass** (GUI tool) - connect and browse collections
- **mongosh** (command line) - run `use nareis` then `show collections`

---

## Troubleshooting

### MongoDB Connection Error
- **Local**: Check if MongoDB service is running
- **Atlas**: Verify IP whitelist includes your IP
- **Both**: Check connection string format

### Port Already in Use
- Change PORT in .env to different number (e.g., 5001)
- Or stop the process using port 5000

### JWT Secret Error
- Make sure JWT_SECRET is set in .env
- Use a long random string

### Email Not Working
- For Gmail, enable "Less secure app access" or use App Password
- Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS

---

## Next Steps

Once MongoDB is set up:
1. ✅ Backend should connect automatically
2. ✅ Collections (users, paymenthistories) will be created on first use
3. ✅ Test signup/login endpoints
4. ✅ Configure Stripe keys for payments
