# Quick Start: MongoDB Setup on VPS

This is a quick reference guide for setting up MongoDB on your VPS. For detailed instructions, see [MONGODB_VPS_SETUP.md](./MONGODB_VPS_SETUP.md).

## Quick Installation (Ubuntu/Debian)

```bash
# 1. Install MongoDB
sudo apt update
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# 2. Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 3. Verify it's running
sudo systemctl status mongod
```

## Configure Your Application

1. **Update `.env` file:**
   ```env
   MONGODB_URI=mongodb://localhost:27017/nareis
   ```

2. **Initialize database:**
   ```bash
   cd nareis-backend
   npm run build
   npm run init-db
   ```

3. **Verify setup:**
   ```bash
   npm run verify-db
   ```

4. **Start your application:**
   ```bash
   npm run dev  # Development
   # or
   npm start    # Production
   ```

## Common Commands

```bash
# Start/Stop MongoDB
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod

# Check status
sudo systemctl status mongod

# View logs
sudo journalctl -u mongod -f

# Connect to MongoDB shell
mongosh
```

## Troubleshooting

**MongoDB won't start:**
```bash
sudo journalctl -u mongod -n 50  # Check logs
```

**Connection refused:**
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check if port is listening: `sudo netstat -tulpn | grep 27017`

**Need help?** See the full guide: [MONGODB_VPS_SETUP.md](./MONGODB_VPS_SETUP.md)
