const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function installChrome() {
  console.log('🔄 Installing Chrome for Puppeteer in container environment...');
  
  // Check if we're in a container environment
  const isContainer = process.env.NODE_ENV === 'production' || 
                     fs.existsSync('/.dockerenv') || 
                     process.env.PTERODACTYL_ENVIRONMENT;
  
  if (isContainer) {
    console.log('📦 Container environment detected, using system approach...');
    return installChromeInContainer();
  }
  
  // First try to use @puppeteer/browsers to install Chrome
  try {
    console.log('📦 Attempting to install Chrome using @puppeteer/browsers...');
    execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
    console.log('✅ Chrome installed successfully via @puppeteer/browsers!');
    return;
  } catch (error) {
    console.log('⚠️ @puppeteer/browsers installation failed, trying direct method...');
  }
  
  // Fallback: try to launch Puppeteer to trigger download
  try {
    console.log('🚀 Attempting to launch Puppeteer to trigger Chrome download...');
    
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    };
    
    // Check for existing Chrome installations
    const chromePaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/snap/bin/chromium'
    ];
    
    for (const path of chromePaths) {
      try {
        fs.accessSync(path, fs.constants.F_OK);
        console.log(`✅ Found existing Chrome at: ${path}`);
        launchOptions.executablePath = path;
        break;
      } catch (e) {
        // Continue searching
      }
    }
    
    const browser = await puppeteer.launch(launchOptions);
    await browser.close();
    console.log('✅ Chrome installation/verification successful!');
    
  } catch (error) {
    console.log('⚠️ Chrome installation failed, but the bot can still work with API fallback');
    console.log('Error details:', error.message);
    // Don't exit with error - let the bot run with API fallback
  }
}

function installChromeInContainer() {
  console.log('🔧 Installing Chrome in container environment...');
  
  try {
    // Check for existing Chrome installations first
    const chromePaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/snap/bin/chromium',
      '/usr/local/bin/chromium',
      '/opt/google/chrome/chrome'
    ];
    
    for (const chromePath of chromePaths) {
      try {
        fs.accessSync(chromePath, fs.constants.F_OK);
        console.log(`✅ Found existing Chrome at: ${chromePath}`);
        
        // Set environment variables
        process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
        process.env.CHROME_BIN = chromePath;
        
        console.log(`🔍 Set PUPPETEER_EXECUTABLE_PATH to: ${chromePath}`);
        return true;
      } catch (e) {
        // Continue searching
      }
    }
    
    console.log('⚠️ No existing Chrome installation found');
    
    // Try to install Chromium using apt-get (most common in containers)
    console.log('📦 Attempting to install Chromium...');
    
    try {
      // Update package lists
      execSync('apt-get update -y', { stdio: 'pipe' });
      
      // Install Chromium
      execSync('apt-get install -y chromium-browser', { stdio: 'pipe' });
      
      console.log('✅ Chromium installed successfully!');
      
      // Set environment variables
      process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
      process.env.CHROME_BIN = '/usr/bin/chromium-browser';
      
      console.log('🔍 Set PUPPETEER_EXECUTABLE_PATH to: /usr/bin/chromium-browser');
      return true;
      
    } catch (aptError) {
      console.log('⚠️ apt-get installation failed, trying alternative methods...');
      
      // Try downloading Chrome manually
      try {
        console.log('📦 Downloading Chrome manually...');
        execSync('wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -', { stdio: 'pipe' });
        execSync('echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list', { stdio: 'pipe' });
        execSync('apt-get update -y', { stdio: 'pipe' });
        execSync('apt-get install -y google-chrome-stable', { stdio: 'pipe' });
        
        console.log('✅ Google Chrome installed successfully!');
        
        // Set environment variables
        process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/google-chrome-stable';
        process.env.CHROME_BIN = '/usr/bin/google-chrome-stable';
        
        console.log('🔍 Set PUPPETEER_EXECUTABLE_PATH to: /usr/bin/google-chrome-stable');
        return true;
        
      } catch (manualError) {
        console.log('⚠️ Manual Chrome installation also failed');
        console.log('📊 Bot will operate in API-only mode');
        return false;
      }
    }
    
  } catch (error) {
    console.log(`❌ Container Chrome installation failed: ${error.message}`);
    console.log('📊 Bot will operate in API-only mode (this is still functional)');
    return false;
  }
}

// Only run if called directly
if (require.main === module) {
  installChrome();
}

module.exports = { installChrome, installChromeInContainer };
