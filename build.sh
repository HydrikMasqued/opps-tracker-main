#!/bin/bash
set -e

echo "Starting optimized build process..."

# Set Puppeteer environment variables
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_SKIP_DOWNLOAD=true  
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
export CHROME_BIN=/usr/bin/chromium

# Set npm config for faster installs
export NPM_CONFIG_CACHE=/tmp/.npm
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NPM_CONFIG_PROGRESS=false
export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_FUND=false
export NPM_CONFIG_LOGLEVEL=error
export NPM_CONFIG_PREFER_OFFLINE=true
export NPM_CONFIG_MAXSOCKETS=1

echo "Installing dependencies with optimized settings..."
npm ci --omit=dev --no-audit --no-fund --prefer-offline --cache /tmp/.npm --maxsockets 1

echo "Build completed successfully!"
