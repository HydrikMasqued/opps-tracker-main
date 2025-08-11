const { join } = require('path');
const os = require('os');

// Detect container environment more reliably
const isContainer = process.env.NODE_ENV === 'production' || 
                  process.env.CONTAINER_ENV || 
                  process.cwd().includes('/home/container') ||
                  process.cwd().includes('/app') ||
                  os.platform() === 'linux';

console.log('🔧 Puppeteer config - Container detected:', isContainer);
console.log('🔧 Puppeteer config - Platform:', os.platform());
console.log('🔧 Puppeteer config - Working dir:', process.cwd());

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Always download Chrome for both local and cloud environments
  chrome: {
    skipDownload: false,
  },
  
  // Firefox not needed
  firefox: {
    skipDownload: true,
  },
  
  // Set cache directory - FIXED for container path
  cacheDirectory: isContainer
    ? '/home/container/.cache/puppeteer'  // Container environment
    : join(__dirname, '.cache', 'puppeteer'), // Local development
  
  // Default product
  defaultProduct: 'chrome',
  
  // Browser revision for consistency
  browserRevision: '121.0.6167.85'
};
