# Cybrancee Deployment Guide
**Repository**: https://github.com/HydrikMasqued/opps-tracker-main  
**Deployment Date**: January 6, 2026  
**Server**: Elyxir (jad794)

---

## 📦 DEPLOYMENT STEPS FOR CYBRANCEE

### 1. Connect to Cybrancee Server
```bash
# SSH into your Cybrancee server or use their panel
```

### 2. Clone/Pull Repository
```bash
# If first time deployment:
git clone https://github.com/HydrikMasqued/opps-tracker-main.git
cd opps-tracker-main

# If updating existing deployment:
cd opps-tracker-main
git pull origin master
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create or update the `.env` file:
```bash
nano .env
```

**Required Configuration**:
```ini
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
BOT_OWNER_ID=your_discord_user_id_here

# Discord Channel IDs for Logging
ELYXIR_LOG_CHANNEL=
GLOBAL_LOG_CHANNEL=your_global_channel_id_here

# Multi-Server Configuration
MONITORING_ENABLED=true
MAX_CONCURRENT_SERVERS=5

# Rate Limiting Settings
REQUEST_DELAY_MS=2000
MAX_RETRIES=3

# Advanced Settings
DEBUG_MODE=false
LOG_LEVEL=info
```

**IMPORTANT**: Replace the following:
- `DISCORD_TOKEN` - Your Discord bot token
- `BOT_OWNER_ID` - Your Discord user ID
- `GLOBAL_LOG_CHANNEL` - Your global log channel ID
- Leave `ELYXIR_LOG_CHANNEL` empty (set via `/setelyxir` command)

### 5. Set Up Process Manager

#### Option A: Using PM2 (Recommended)
```bash
# Install PM2 if not already installed
npm install -g pm2

# Start the bot
pm2 start bot.js --name "opps-tracker"

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

#### Option B: Using systemd
Create service file:
```bash
sudo nano /etc/systemd/system/opps-tracker.service
```

Add configuration:
```ini
[Unit]
Description=Opps Tracker Discord Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/opps-tracker-main
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable opps-tracker
sudo systemctl start opps-tracker
```

#### Option C: Using Screen (Simple)
```bash
# Create a screen session
screen -S opps-tracker

# Start the bot
node bot.js

# Detach from screen: Press Ctrl+A then D
# Reattach later: screen -r opps-tracker
```

### 6. Verify Deployment
Check if bot is running:
```bash
# If using PM2:
pm2 status
pm2 logs opps-tracker

# If using systemd:
sudo systemctl status opps-tracker
sudo journalctl -u opps-tracker -f

# If using screen:
screen -r opps-tracker
```

---

## 🔧 CONFIGURATION IN DISCORD

Once the bot is running, configure it in Discord:

### First-Time Setup:
1. **Invite Bot to Server** (if not already done)
   - Ensure bot has proper permissions
   - Needs: Send Messages, Embed Links, Read Message History, Use Slash Commands

2. **Set Log Channel**:
   ```
   /setelyxir
   ```
   - Run in the channel where you want player notifications
   - Or specify a channel as parameter

3. **Start Monitoring**:
   ```
   /startmonitor
   ```
   - Begins automatic player tracking on Elyxir server

4. **Test Connection**:
   ```
   /elyxir
   ```
   - Should show current players on Elyxir server
   - Takes 30-60 seconds

5. **Add Tracked Players**:
   ```
   /track player:PlayerName category:enemies reason:Test
   ```
   - Categories: enemies, poi (people of interest), club

---

## 📊 MONITORING & MAINTENANCE

### Check Bot Health:
```
!debug status
```
- Shows uptime, memory usage, error count
- Owner only command

### View Error Logs:
```
!debug errors
```
- Shows recent errors
- Owner only command

### Export Diagnostics:
```
!debug export
```
- Creates comprehensive debug file
- Owner only command

### Restart Bot:
```
!restart
```
- Gracefully restarts the bot
- Saves all data before restarting
- Owner only command

### Manual Restart (Server Side):
```bash
# If using PM2:
pm2 restart opps-tracker

# If using systemd:
sudo systemctl restart opps-tracker

# If using screen:
screen -r opps-tracker
# Ctrl+C to stop, then: node bot.js
```

---

## 🔄 UPDATING THE BOT

### Pull Latest Changes:
```bash
cd /path/to/opps-tracker-main
git pull origin master
npm install  # Install any new dependencies
```

### Restart After Update:
```bash
# PM2:
pm2 restart opps-tracker

# systemd:
sudo systemctl restart opps-tracker

# screen:
screen -r opps-tracker
# Ctrl+C, then: node bot.js
```

---

## 📁 IMPORTANT FILES

**Core Files**:
- `bot.js` - Main bot file (do not modify on server)
- `.env` - Environment configuration (KEEP SECRET)
- `package.json` - Dependencies
- `.puppeteerrc.cjs` - Puppeteer configuration

**Data Files** (Auto-generated):
- `player_tracking_data.json` - Active player tracking
- `tracked_players.json` - Watchlist
- `player_database.json` - Historical database
- `private_tracked_players.json` - Private tracking
- `debug_errors.json` - Error logs
- `debug_log.json` - Debug logs

**Backup These Files**:
```bash
# Create backup
cp player_database.json player_database.backup.json
cp tracked_players.json tracked_players.backup.json
```

---

## 🔒 SECURITY NOTES

### Protect Your .env File:
```bash
# Set proper permissions
chmod 600 .env

# Never commit to git
echo ".env" >> .gitignore
```

### Discord Token Security:
- ⚠️ Never share your Discord token
- ⚠️ Never commit .env to git
- ⚠️ Regenerate token if exposed
- ⚠️ Use environment variables on production

### Server Security:
- Keep Node.js updated
- Use firewall rules
- Restrict SSH access
- Regular backups

---

## 🐛 TROUBLESHOOTING

### Bot Won't Start:
```bash
# Check Node.js version (requires v14+)
node --version

# Check syntax
node --check bot.js

# Check logs
pm2 logs opps-tracker
# or
sudo journalctl -u opps-tracker -n 100
```

### Commands Not Working:
1. Check bot has proper Discord permissions
2. Verify "Full Patch" role exists for tracking commands
3. Run `/refresh` to test server connection
4. Check error logs: `!debug errors`

### Tracking Not Working:
1. Verify Elyxir server is online
2. Check server ID is correct: `jad794`
3. Test with `/elyxir` command
4. Ensure monitoring is started: `/startmonitor`

### High Memory Usage:
```bash
# Restart bot to clear memory
pm2 restart opps-tracker

# Or restart with memory limit
pm2 start bot.js --name opps-tracker --max-memory-restart 500M
```

### Chrome/Puppeteer Issues:
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libpangocairo-1.0-0 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

---

## 📞 SUPPORT COMMANDS

### PM2 Commands:
```bash
pm2 list                    # List all processes
pm2 logs opps-tracker       # View logs
pm2 restart opps-tracker    # Restart bot
pm2 stop opps-tracker       # Stop bot
pm2 start opps-tracker      # Start bot
pm2 delete opps-tracker     # Remove from PM2
pm2 monit                   # Monitor all processes
```

### Git Commands:
```bash
git status                  # Check for changes
git pull origin master      # Update code
git log --oneline -5        # View recent commits
git reset --hard origin/master  # Force sync with remote
```

### File Management:
```bash
ls -la                      # List all files
du -sh *                    # Check file sizes
tail -f debug_errors.json   # Watch error log
cat player_database.json | jq  # View database (if jq installed)
```

---

## 🎯 SERVER CONFIGURATION

**Current Setup**:
- **Server**: Elyxir
- **Server ID**: jad794
- **URL**: https://servers.fivem.net/servers/detail/jad794
- **Monitoring**: Automatic every 3-8 seconds
- **Tracking**: Single server only (no multi-server)

**Commands Available**:
- 12 Slash commands (public/admin)
- 6 Owner-only text commands
- All commands documented in COMMAND_ANALYSIS_REPORT.md

---

## 📈 PERFORMANCE EXPECTATIONS

**Startup**:
- Cold start: ~10-15 seconds
- Warm start: ~5-7 seconds
- Chrome install (first time): +5-10 seconds

**Command Response Times**:
- Instant: `/track`, `/untrack`, `/tracked`, `/search`
- Fast (1-5s): `/database`, `/startmonitor`
- Slow (30-60s): `/elyxir`, `/find`, `/refresh`

**Resource Usage**:
- Memory: ~150-250 MB
- CPU: Low (<5% idle, 10-30% during monitoring)
- Disk: ~200 MB (with dependencies)
- Network: Minimal (API calls every 3-8 seconds)

---

## ✅ DEPLOYMENT CHECKLIST

Before going live:
- [ ] Repository cloned/updated
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with correct values
- [ ] Discord bot token set
- [ ] Bot owner ID set
- [ ] Process manager configured (PM2/systemd/screen)
- [ ] Bot started successfully
- [ ] Bot appears online in Discord
- [ ] `/setelyxir` command run in Discord
- [ ] `/startmonitor` command run
- [ ] `/elyxir` tested successfully
- [ ] Test player tracking works
- [ ] Logs are being generated
- [ ] Bot auto-restarts on crash
- [ ] Backups configured (optional)

---

## 🆘 EMERGENCY PROCEDURES

### Bot Crashed:
```bash
pm2 restart opps-tracker
# or
sudo systemctl restart opps-tracker
```

### Data Corruption:
```bash
# Restore from backup
cp player_database.backup.json player_database.json
cp tracked_players.backup.json tracked_players.json
pm2 restart opps-tracker
```

### Token Compromised:
1. Regenerate Discord bot token immediately
2. Update `.env` file with new token
3. Restart bot
4. Check for unauthorized changes

### Complete Reset:
```bash
# Stop bot
pm2 stop opps-tracker

# Backup data
cp -r . ../opps-tracker-backup

# Pull fresh code
git reset --hard origin/master
git pull origin master

# Reinstall
rm -rf node_modules
npm install

# Restart
pm2 restart opps-tracker
```

---

**Deployment Guide Version**: 1.0  
**Last Updated**: January 6, 2026  
**Maintained By**: HydrikMasqued  
**Repository**: https://github.com/HydrikMasqued/opps-tracker-main
