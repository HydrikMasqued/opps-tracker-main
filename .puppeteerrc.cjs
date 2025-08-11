const { join } = require('path');
const os = require('os');

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
  
  // Set cache directory based on environment
  cacheDirectory: process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV || process.cwd().includes('/home/container')
    ? '/home/container/.cache/puppeteer'  // Container environment
    : join(__dirname, '.cache', 'puppeteer'), // Local development
  
  // Default launch options for container environment
  defaultProduct: 'chrome',
  
  // Ensure we use the same browser version across environments
  browserRevision: '121.0.6167.85'
};
