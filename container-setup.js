#!/usr/bin/env node

/**
 * Container Setup Script for Discord Bot
 * This script configures the environment for container deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🐳 Container setup starting...');

// Set container environment variables
process.env.CONTAINER_ENV = 'true';
process.env.NODE_ENV = 'production';

console.log('🔧 Environment configured for container deployment');
console.log(`📁 Puppeteer cache directory: /home/container/.cache/puppeteer`);
console.log('🌍 Environment variables set:');
console.log('   - CONTAINER_ENV=true');
console.log('   - NODE_ENV=production');

// Create cache directory if it doesn't exist
const cacheDir = '/home/container/.cache/puppeteer';
try {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`✅ Created cache directory: ${cacheDir}`);
    } else {
        console.log(`✅ Cache directory already exists: ${cacheDir}`);
    }
} catch (error) {
    console.log(`⚠️ Could not create cache directory: ${error.message}`);
}

// Check if we're actually in a container
const isContainer = fs.existsSync('/.dockerenv') || 
                    fs.existsSync('/proc/1/cgroup') ||
                    process.env.container ||
                    process.env.CONTAINER_ENV;

if (isContainer) {
    console.log('🐳 Container environment detected');
} else {
    console.log('💻 Local development environment detected');
}

console.log('✅ Container setup completed!');
