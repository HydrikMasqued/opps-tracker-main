const { join } = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Always allow Chrome download for reliability
  chrome: {
    skipDownload: false,
  },
  
  // Set cache directory based on environment
  cacheDirectory: process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV || process.cwd().includes('/home/container')
    ? '/home/container/.cache/puppeteer'  // Container environment
    : join(__dirname, '.cache', 'puppeteer'), // Local development
  
  // Default launch options for container environment
  defaultProduct: 'chrome'
};
