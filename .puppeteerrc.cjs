const { join } = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip download on cloud servers (Linux), allow on Windows for development
  chrome: {
    skipDownload: os.platform() === 'linux',
  },
  
  // Set cache directory based on environment
  cacheDirectory: process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV
    ? '/home/container/.cache/puppeteer'  // Container environment
    : join(__dirname, '.cache', 'puppeteer'), // Local development
  
  // Default launch options for container environment
  defaultProduct: 'chrome'
};
