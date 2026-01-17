# Quick Start Guide

## Prerequisites
- Node.js installed (v18 or higher)
- MongoDB (local or Atlas)

## Setup Steps

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Set Up MongoDB

**Option A: MongoDB Atlas (Cloud - Easiest)**
1. Sign up at https://www.mongodb.com/cloud/atlas/register
2. Create free cluster (M0)
3. Create database user
4. Whitelist your IP (or allow all for dev)
5. Get connection string

**Option B: Local MongoDB**
1. Download from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. Connection string: `mongodb://localhost:27017/nareis`

### 3. Create .env File
```bash
# Copy example file
cp .env.example .env
```

Edit `.env` and set:
```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=generate-random-secret-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:5173
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start Backend
```bash
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

### 5. Test API
```bash
# Health check
curl http://localhost:5000/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Database Collections

Collections are created automatically on first use:
- `users` - User accounts
- `paymenthistories` - Payment records

## Troubleshooting

**MongoDB not connecting?**
- Check MongoDB is running (local) or IP whitelisted (Atlas)
- Verify connection string in .env
- Check username/password are correct

**Port 5000 in use?**
- Change PORT in .env to another port (e.g., 5001)

**Need help?**
- See SETUP_GUIDE.md for detailed instructions
