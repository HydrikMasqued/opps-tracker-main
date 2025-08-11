#!/bin/bash

echo "🔧 OPPS Tracker Chrome Fix Script"
echo "=================================="

# Try method 1: npx puppeteer browsers install chrome
echo "📦 Method 1: Installing Chrome via @puppeteer/browsers..."
if npx puppeteer browsers install chrome; then
    echo "✅ Chrome installed successfully!"
    exit 0
fi

# Try method 2: Install system Chrome
echo "🐧 Method 2: Installing system Chrome packages..."

# Update package lists
apt-get update -qq

# Try installing Chromium
if apt-get install -y chromium-browser chromium; then
    echo "✅ Chromium installed successfully!"
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
    echo "Set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"
    exit 0
fi

# Try installing Google Chrome
echo "🌐 Method 3: Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update -qq
if apt-get install -y google-chrome-stable; then
    echo "✅ Google Chrome installed successfully!"
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
    echo "Set PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable"
    exit 0
fi

echo "❌ All installation methods failed"
echo "⚠️ The bot will fall back to API-only mode"
echo "💡 This is normal - the bot can work without Chrome using FiveM API"
