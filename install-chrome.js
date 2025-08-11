const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Chrome Installation Script for Cloud Deployment
 * Uses the exact approach recommended: npx puppeteer browsers install chrome
 * with proper cache directory configuration
 */

async function installChrome() {
  console.log('🚀 Chrome Installation for Cloud Deployment');
  console.log('============================================');
  
  // Detect container environment
  const isContainer = process.env.NODE_ENV === 'production' || 
                     process.env.CONTAINER_ENV || 
                     process.cwd().includes('/home/container') ||
                     process.cwd().includes('/app') ||
                     process.platform === 'linux';
  
  console.log('🔍 Environment Detection:');
  console.log('  - Platform:', process.platform);
  console.log('  - Working Directory:', process.cwd());
  console.log('  - Container Environment:', isContainer);
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  
  // Set CORRECT cache directory for container
  const cacheDir = isContainer 
    ? '/home/container/.cache/puppeteer'
    : path.join(__dirname, '.cache', 'puppeteer');
  
  console.log('📁 Cache Directory:', cacheDir);
  
  // Create cache directory
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      console.log('✅ Created cache directory');
    }
    
    // Test write permissions
    fs.accessSync(cacheDir, fs.constants.W_OK);
    console.log('✅ Cache directory is writable');
    
  } catch (error) {
    console.error('❌ Cache directory issue:', error.message);
    if (isContainer) {
      try {
        execSync(`chmod -R 755 ${cacheDir}`, { stdio: 'inherit' });
        console.log('✅ Fixed permissions');
      } catch (e) {
        console.warn('⚠️ Permission fix failed, continuing...');
      }
    }
  }
  
  // Set environment for Puppeteer
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  
  // Use the EXACT command you specified
  console.log('\n🔧 Installing Chrome using: npx puppeteer browsers install chrome');
  console.log('Cache Directory:', cacheDir);
  
  try {
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir
      }
    });
    
    console.log('✅ Chrome installation completed successfully!');
    
    // Verify installation
    try {
      execSync('npx puppeteer browsers list', { stdio: 'inherit' });
    } catch (e) {
      console.log('⚠️ Could not list browsers, but installation may have succeeded');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ npx puppeteer browsers install failed:', error.message);
    console.log('\n🔧 Trying fallback installation...');
    return installChromeInContainer();
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
