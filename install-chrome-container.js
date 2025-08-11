#!/usr/bin/env node

/**
 * Chrome Installation Script for Container Deployment
 * Run this after npm install in container environments
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Chrome Container Installation Script');

// Check if we're in a container
const isContainer = fs.existsSync('/.dockerenv') || 
                    fs.existsSync('/proc/1/cgroup') ||
                    process.env.container ||
                    process.env.CONTAINER_ENV ||
                    process.cwd().includes('/home/container');

if (!isContainer) {
    console.log('💻 Not in container - skipping container-specific setup');
    process.exit(0);
}

console.log('🐳 Container environment detected');

// Set environment variables
process.env.PUPPETEER_CACHE_DIR = '/home/container/.cache/puppeteer';
process.env.CONTAINER_ENV = 'true';

// Create cache directory
const cacheDir = '/home/container/.cache/puppeteer';
try {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`✅ Created cache directory: ${cacheDir}`);
    }
} catch (error) {
    console.log(`⚠️ Could not create cache directory: ${error.message}`);
}

// Install Chrome
async function installChrome() {
    console.log('📦 Installing Chrome...');
    
    try {
        // Method 1: Install via Puppeteer
        console.log('🔧 Trying Puppeteer Chrome installation...');
        execSync('npx puppeteer browsers install chrome', { 
            stdio: 'inherit',
            env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir }
        });
        console.log('✅ Chrome installed successfully via Puppeteer!');
        
        // Verify installation
        const chromeDir = cacheDir + '/chrome';
        if (fs.existsSync(chromeDir)) {
            console.log('✅ Chrome installation verified');
            const versions = fs.readdirSync(chromeDir);
            console.log('📋 Available Chrome versions:', versions.join(', '));
        }
        
    } catch (puppeteerError) {
        console.log('⚠️ Puppeteer installation failed, trying system install...');
        
        try {
            // Method 2: System installation
            console.log('🔧 Installing Chromium via system package manager...');
            execSync('apt-get update -y && apt-get install -y chromium-browser wget', { 
                stdio: 'inherit' 
            });
            console.log('✅ Chromium installed via apt!');
        } catch (systemError) {
            console.log('⚠️ System installation also failed');
            console.log('🔄 Bot will try to work with available browsers or API-only mode');
        }
    }
}

installChrome().then(() => {
    console.log('🎯 Chrome installation script completed!');
    console.log('🤖 You can now start the bot with: node bot.js');
}).catch(error => {
    console.log('❌ Installation failed:', error.message);
    console.log('🔄 Bot may still work in API-only mode');
});
