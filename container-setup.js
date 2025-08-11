#!/usr/bin/env node

/**
 * Container Setup Script for Discord Bot
 * This script configures the environment for container deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🐳 Container setup starting...');

// Set container environment variables
process.env.CONTAINER_ENV = 'true';
process.env.NODE_ENV = 'production';
process.env.PUPPETEER_CACHE_DIR = '/home/container/.cache/puppeteer';

console.log('🔧 Environment configured for container deployment');
console.log(`📁 Puppeteer cache directory: /home/container/.cache/puppeteer`);
console.log('🌍 Environment variables set:');
console.log('   - CONTAINER_ENV=true');
console.log('   - NODE_ENV=production');
console.log('   - PUPPETEER_CACHE_DIR=/home/container/.cache/puppeteer');

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

// Install Chrome if not present
async function installChrome() {
    try {
        console.log('🔍 Checking for Chrome installation...');
        
        // Try to install Chrome via Puppeteer
        try {
            console.log('📦 Installing Chrome via Puppeteer...');
            execSync('npx puppeteer browsers install chrome', { 
                stdio: 'inherit',
                cwd: process.cwd(),
                env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir }
            });
            console.log('✅ Chrome installed successfully via Puppeteer!');
        } catch (puppeteerError) {
            console.log('⚠️ Puppeteer Chrome install failed, trying system install...');
            
            // Try system Chrome installation as fallback
            try {
                execSync('apt-get update -y && apt-get install -y chromium-browser', { stdio: 'inherit' });
                console.log('✅ Chromium installed via apt!');
            } catch (systemError) {
                console.log('⚠️ System Chrome install also failed - bot will try to use bundled Chrome');
            }
        }
    } catch (error) {
        console.log(`⚠️ Chrome installation error: ${error.message}`);
        console.log('🔄 Bot will attempt to use available Chrome or fall back to API-only mode');
    }
}

// Check if we're actually in a container
const isContainer = fs.existsSync('/.dockerenv') || 
                    fs.existsSync('/proc/1/cgroup') ||
                    process.env.container ||
                    process.env.CONTAINER_ENV ||
                    process.cwd().includes('/home/container');

if (isContainer) {
    console.log('🐳 Container environment detected');
    // Install Chrome in container environment
    installChrome().then(() => {
        console.log('✅ Container setup completed!');
    });
} else {
    console.log('💻 Local development environment detected');
    console.log('✅ Container setup completed!');
}
