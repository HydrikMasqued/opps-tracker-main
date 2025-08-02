# Use official Node.js runtime as base image
FROM node:22-slim

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2t64 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV NODE_ENV=production

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with Puppeteer skip flags
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    npm ci --omit=dev --no-audit --no-fund

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "Enhanced Player Tracker with Join Leave Logging.js"]
