# Chrome/Puppeteer Troubleshooting Guide

## The Issue
The bot uses Puppeteer to scrape player data from FiveM server pages. In containerized environments (like Pterodactyl), Chrome may not be automatically available.

## How the Bot Works (Fallback System)
1. **Primary Method**: Direct FiveM API calls (Chrome-free) ✅
2. **Fallback Method**: Puppeteer with Chrome (for when API fails) 🔄

## QUICK FIX (Recommended)

### Option 1: Run the Quick Fix Script
```bash
node quick-chrome-fix.js
```
This will automatically detect, install, and configure Chrome for your container.

### Option 2: Manual Chrome Installation
```bash
# Make the setup script executable and run it
chmod +x setup-chrome.sh
./setup-chrome.sh
```

### Option 3: Simple Manual Installation
```bash
# Update packages and install Chromium
apt-get update -y
apt-get install -y chromium-browser

# Set environment variables
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
export CHROME_BIN=/usr/bin/chromium-browser
```

### Option 4: Use Existing Chrome (if already installed)
```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# or
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## Environment Variables
Set these in your Pterodactyl panel if Chrome is installed:
- `CHROME_BIN=/usr/bin/chromium-browser`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`

## Important Notes
- ✅ **The bot will still work without Chrome** - it uses API fallback
- 🔄 Chrome is only needed as a backup scraping method
- 📊 Most functionality works via direct API calls
- 🎯 Player tracking and logging work regardless of Chrome status

## Expected Behavior
```
✅ API extraction successful: 45 players
```
OR
```
⚠️ API method failed, trying Puppeteer...
✅ Puppeteer extraction successful: 45 players
```
OR (if Chrome fails)
```
⚠️ API method failed, trying Puppeteer...
❌ Extraction failed: Could not find Chrome
⚠️ Falling back to API-only mode
```

## If All Else Fails
The bot can operate in API-only mode. The Chrome error is not fatal - the bot will continue running and use the FiveM API for all operations.
