const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚨 AUTO-CHROME INSTALLER - Running automatically...');

async function autoInstallChrome() {
    try {
        // Check if we're in a Linux container environment
        const isLinux = process.platform === 'linux' || fs.existsSync('/etc/os-release');
        
        if (!isLinux) {
            console.log('✅ Not in Linux container - Chrome installation not needed');
            return true;
        }

        console.log('🐧 Linux container detected - checking for Chrome...');

        // Check for existing Chrome installations
        const chromePaths = [
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/snap/bin/chromium',
            '/usr/local/bin/chromium',
            '/opt/google/chrome/chrome'
        ];

        // Test each Chrome path
        for (const chromePath of chromePaths) {
            try {
                fs.accessSync(chromePath, fs.constants.F_OK);
                
                // Test if Chrome can run
                try {
                    execSync(`${chromePath} --version`, { stdio: 'pipe', timeout: 10000 });
                    console.log(`✅ Working Chrome found at: ${chromePath}`);
                    
                    // Set environment variables
                    process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
                    process.env.CHROME_BIN = chromePath;
                    
                    console.log('🔧 Environment variables set successfully!');
                    console.log(`   PUPPETEER_EXECUTABLE_PATH=${chromePath}`);
                    console.log(`   CHROME_BIN=${chromePath}`);
                    
                    return true;
                } catch (testError) {
                    console.log(`⚠️ Chrome found but not working at: ${chromePath}`);
                }
            } catch (e) {
                // Chrome not found at this path, continue
            }
        }

        console.log('❌ No working Chrome found - attempting installation...');

        // Try to install Chromium
        try {
            console.log('📦 Installing Chromium browser...');
            
            // Update package lists
            execSync('apt-get update -y', { stdio: 'pipe', timeout: 60000 });
            console.log('✅ Package lists updated');
            
            // Install Chromium
            execSync('apt-get install -y chromium-browser', { stdio: 'pipe', timeout: 120000 });
            console.log('✅ Chromium installation completed');
            
            // Test the installation
            const chromiumPath = '/usr/bin/chromium-browser';
            try {
                fs.accessSync(chromiumPath, fs.constants.F_OK);
                execSync(`${chromiumPath} --version`, { stdio: 'pipe', timeout: 10000 });
                
                console.log('🎉 SUCCESS! Chromium is working!');
                
                // Set environment variables
                process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
                process.env.CHROME_BIN = chromiumPath;
                
                console.log('🔧 Environment variables set successfully!');
                console.log(`   PUPPETEER_EXECUTABLE_PATH=${chromiumPath}`);
                console.log(`   CHROME_BIN=${chromiumPath}`);
                
                return true;
                
            } catch (testError) {
                console.log('⚠️ Chromium installed but not working properly');
            }
            
        } catch (installError) {
            console.log('⚠️ Chromium installation failed, trying Google Chrome...');
            
            try {
                // Install Google Chrome
                console.log('📦 Installing Google Chrome...');
                
                // Add Google Chrome repository
                execSync('wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -', { stdio: 'pipe', timeout: 30000 });
                execSync('echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list', { stdio: 'pipe' });
                
                // Update and install
                execSync('apt-get update -y', { stdio: 'pipe', timeout: 60000 });
                execSync('apt-get install -y google-chrome-stable', { stdio: 'pipe', timeout: 120000 });
                
                console.log('✅ Google Chrome installation completed');
                
                // Test Chrome installation
                const chromePath = '/usr/bin/google-chrome-stable';
                try {
                    fs.accessSync(chromePath, fs.constants.F_OK);
                    execSync(`${chromePath} --version`, { stdio: 'pipe', timeout: 10000 });
                    
                    console.log('🎉 SUCCESS! Google Chrome is working!');
                    
                    // Set environment variables
                    process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
                    process.env.CHROME_BIN = chromePath;
                    
                    console.log('🔧 Environment variables set successfully!');
                    console.log(`   PUPPETEER_EXECUTABLE_PATH=${chromePath}`);
                    console.log(`   CHROME_BIN=${chromePath}`);
                    
                    return true;
                    
                } catch (testError) {
                    console.log('⚠️ Google Chrome installed but not working properly');
                }
                
            } catch (chromeError) {
                console.log('⚠️ Google Chrome installation also failed');
            }
        }

        // If we get here, installation failed
        console.log('');
        console.log('❌ Chrome installation failed, but DON\'T WORRY!');
        console.log('📊 Your bot will work in API-only mode:');
        console.log('   ✅ Player tracking still works');
        console.log('   ✅ Discord logging still works');
        console.log('   ✅ All commands still work (!players, !horizon, etc.)');
        console.log('   ⚠️ Only Chrome fallback scraping won\'t work (rarely needed)');
        console.log('');
        console.log('💡 This is NOT a fatal error - your bot is fully functional!');
        
        return false;

    } catch (error) {
        console.log('❌ Auto Chrome installer failed:', error.message);
        console.log('📊 Bot will continue in API-only mode (still functional)');
        return false;
    }
}

// Export the function so it can be called from the main bot
module.exports = { autoInstallChrome };

// Run automatically if this file is executed directly
if (require.main === module) {
    autoInstallChrome();
}
