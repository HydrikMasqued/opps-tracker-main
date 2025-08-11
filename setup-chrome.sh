#!/bin/bash

echo "🔄 Setting up Chrome for Puppeteer in container environment..."

# Update package lists
apt-get update -y

# Install Chrome dependencies
echo "📦 Installing Chrome dependencies..."
apt-get install -y \
    wget \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils

# Try to install Chromium first (more lightweight)
echo "🔧 Attempting to install Chromium..."
if apt-get install -y chromium-browser; then
    echo "✅ Chromium installed successfully!"
    echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> ~/.bashrc
    echo "export CHROME_BIN=/usr/bin/chromium-browser" >> ~/.bashrc
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
    export CHROME_BIN=/usr/bin/chromium-browser
else
    echo "⚠️ Chromium installation failed, trying Google Chrome..."
    
    # Add Google Chrome repository
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
    apt-get update -y
    
    # Install Google Chrome
    if apt-get install -y google-chrome-stable; then
        echo "✅ Google Chrome installed successfully!"
        echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable" >> ~/.bashrc
        echo "export CHROME_BIN=/usr/bin/google-chrome-stable" >> ~/.bashrc
        export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
        export CHROME_BIN=/usr/bin/google-chrome-stable
    else
        echo "❌ Both Chromium and Google Chrome installation failed"
        echo "⚠️ Bot will use API-only mode"
        exit 0  # Don't fail the entire process
    fi
fi

# Test Chrome installation
echo "🧪 Testing Chrome installation..."
if command -v chromium-browser >/dev/null 2>&1; then
    echo "✅ Chromium found: $(chromium-browser --version)"
    chromium-browser --version
elif command -v google-chrome-stable >/dev/null 2>&1; then
    echo "✅ Google Chrome found: $(google-chrome-stable --version)"
    google-chrome-stable --version
else
    echo "⚠️ No Chrome executable found, but continuing..."
fi

echo "🎯 Chrome setup completed!"
echo "🔄 Bot will now use Chrome for fallback scraping when API fails"
