const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip automatic Chrome download
  chrome: {
    skipDownload: true,
  },
  
  // Set cache directory to local folder to avoid permission issues
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Default launch options for container environment
  defaultProduct: 'chrome',
  
  // Container-optimized settings
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
};
