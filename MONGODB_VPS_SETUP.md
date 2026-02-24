# MongoDB VPS Setup Guide

This guide will help you set up MongoDB on your VPS for the NAREIS project.

## Prerequisites

- A VPS with Ubuntu/Debian Linux (or similar)
- SSH access to your VPS
- Root or sudo privileges

## Step 1: Install MongoDB

### For Ubuntu/Debian:

```bash
# Update package list
sudo apt update

# Install dependencies
sudo apt install -y wget curl gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release

# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list again
sudo apt update

# Install MongoDB
sudo apt install -y mongodb-org

# Verify installation
mongod --version
```

### For CentOS/RHEL:

```bash
# Create MongoDB repository file
sudo vi /etc/yum.repos.d/mongodb-org-7.0.repo

# Add the following content:
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc

# Install MongoDB
sudo yum install -y mongodb-org

# Verify installation
mongod --version
```

## Step 2: Start and Enable MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod

# Check MongoDB status
sudo systemctl status mongod
```

You should see `active (running)` in the status output.

## Step 3: Configure MongoDB (Optional but Recommended)

### Create data directory (if needed):

```bash
# MongoDB usually creates this automatically, but you can verify
sudo mkdir -p /data/db
sudo chown -R mongod:mongod /data/db
```

### Configure MongoDB to bind to localhost (for security):

Edit the MongoDB configuration file:

```bash
sudo nano /etc/mongod.conf
```

Find the `net` section and ensure it looks like this:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1  # Only allow local connections
```

**For remote access (if needed):**
If you need to access MongoDB from your application server (if it's on a different machine), you can:
1. Change `bindIp` to `0.0.0.0` (less secure)
2. Or use SSH tunneling (more secure)

After making changes, restart MongoDB:

```bash
sudo systemctl restart mongod
```

## Step 4: Secure MongoDB (Important!)

### Create an admin user:

```bash
# Connect to MongoDB
mongosh

# In the MongoDB shell, run:
use admin

db.createUser({
  user: "admin",
  pwd: "your-secure-password-here",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})

# Exit MongoDB shell
exit
```

### Enable authentication:

```bash
sudo nano /etc/mongod.conf
```

Add or uncomment the security section:

```yaml
security:
  authorization: enabled
```

Restart MongoDB:

```bash
sudo systemctl restart mongod
```

### Test authentication:

```bash
mongosh -u admin -p your-secure-password-here --authenticationDatabase admin
```

## Step 5: Create Database and User for NAREIS

```bash
# Connect to MongoDB (with authentication if enabled)
mongosh -u admin -p your-secure-password-here --authenticationDatabase admin

# Or if authentication is not enabled:
mongosh
```

In the MongoDB shell:

```javascript
// Switch to nareis database (will be created automatically)
use nareis

// Create a dedicated user for the application
db.createUser({
  user: "nareis_user",
  pwd: "your-application-password-here",
  roles: [
    { role: "readWrite", db: "nareis" }
  ]
})

// Verify user creation
db.getUsers()

// Exit
exit
```

## Step 6: Configure Firewall (if applicable)

If you have a firewall enabled, make sure MongoDB port is not exposed publicly (for security):

```bash
# Check if UFW is active
sudo ufw status

# If you need to allow MongoDB only from localhost (default behavior)
# No action needed - MongoDB binds to 127.0.0.1 by default

# If you need remote access (NOT RECOMMENDED for production):
# sudo ufw allow from YOUR_APP_SERVER_IP to any port 27017
```

## Step 7: Configure Your Application

### Update your `.env` file:

**For local MongoDB without authentication:**
```env
MONGODB_URI=mongodb://localhost:27017/nareis
```

**For local MongoDB with authentication:**
```env
MONGODB_URI=mongodb://nareis_user:your-application-password-here@localhost:27017/nareis?authSource=nareis
```

**For MongoDB with admin authentication:**
```env
MONGODB_URI=mongodb://admin:your-secure-password-here@localhost:27017/nareis?authSource=admin
```

## Step 8: Initialize Database Schema

After setting up MongoDB and configuring your `.env` file, initialize the database:

```bash
cd nareis-backend

# Build the project
npm run build

# Initialize database (creates indexes)
npm run init-db

# Verify database setup
npm run verify-db
```

## Step 9: Start Your Application

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Troubleshooting

### MongoDB won't start:

```bash
# Check MongoDB logs
sudo journalctl -u mongod -n 50

# Check if port 27017 is in use
sudo netstat -tulpn | grep 27017

# Check MongoDB process
ps aux | grep mongod
```

### Connection refused:

1. Verify MongoDB is running: `sudo systemctl status mongod`
2. Check MongoDB is listening: `sudo netstat -tulpn | grep 27017`
3. Verify `bindIp` in `/etc/mongod.conf`
4. Check firewall settings

### Authentication errors:

1. Verify username and password
2. Check `authSource` in connection string
3. Verify user has correct roles: `db.getUser("nareis_user")`

### Permission errors:

```bash
# Fix data directory permissions
sudo chown -R mongod:mongod /var/lib/mongodb
sudo chown -R mongod:mongod /data/db
```

## MongoDB Management Commands

### Start/Stop/Restart MongoDB:

```bash
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod
sudo systemctl status mongod
```

### View MongoDB logs:

```bash
sudo journalctl -u mongod -f
# Or
sudo tail -f /var/log/mongodb/mongod.log
```

### Backup database:

```bash
mongodump --uri="mongodb://nareis_user:password@localhost:27017/nareis" --out=/backup/path
```

### Restore database:

```bash
mongorestore --uri="mongodb://nareis_user:password@localhost:27017/nareis" /backup/path/nareis
```

## Database Collections

After running your application, the following collections will be created automatically:

- `users` - User accounts and profiles
- `events` - Event information
- `eventregistrations` - Event registration records
- `eventwaitlists` - Waitlist entries
- `eventfeedbacks` - Event feedback and ratings
- `paymenthistories` - Payment transaction history

All indexes defined in your models will be created automatically when the collections are first used.

## Security Best Practices

1. ✅ Always use authentication in production
2. ✅ Bind MongoDB to localhost (127.0.0.1) only
3. ✅ Use strong passwords for database users
4. ✅ Regularly update MongoDB
5. ✅ Enable MongoDB logging
6. ✅ Set up regular backups
7. ✅ Monitor MongoDB logs for suspicious activity
8. ✅ Use firewall rules to restrict access

## Additional Resources

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)
- [MongoDB Performance Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)

---

**Note:** This guide assumes you're setting up MongoDB on the same VPS as your application. If your application is on a different server, you'll need to configure MongoDB to accept remote connections and update your connection string accordingly (with proper security measures).
