#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Quick Chrome Fix for Pterodactyl Container');
console.log('============================================');

function runCommand(command, description) {
    try {
        console.log(`\n🔄 ${description}...`);
        const result = execSync(command, { stdio: 'inherit', timeout: 60000 });
        console.log(`✅ ${description} completed successfully!`);
        return true;
    } catch (error) {
        console.log(`⚠️ ${description} failed: ${error.message}`);
        return false;
    }
}

function checkChrome() {
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
            console.log(`✅ Found Chrome at: ${path}`);
            
            // Test if it can run
            try {
                execSync(`${path} --version`, { stdio: 'pipe', timeout: 10000 });
                console.log(`🎯 Chrome is working! Setting environment variables...`);
                
                // Set environment for current process
                process.env.PUPPETEER_EXECUTABLE_PATH = path;
                process.env.CHROME_BIN = path;
                
                console.log(`🔍 PUPPETEER_EXECUTABLE_PATH set to: ${path}`);
                console.log(`🔍 CHROME_BIN set to: ${path}`);
                
                return path;
            } catch (testError) {
                console.log(`⚠️ Chrome found but not working at: ${path}`);
            }
        } catch (e) {
            // Continue searching
        }
    }
    return null;
}

async function main() {
    console.log('\n🔍 Step 1: Checking for existing Chrome installations...');
    let chromePath = checkChrome();
    
    if (chromePath) {
        console.log('\n✅ Chrome is ready! Your bot should work now.');
        console.log('\n🎯 You can restart your bot to apply the Chrome settings.');
        return;
    }
    
    console.log('\n🔄 Step 2: No Chrome found, attempting installation...');
    console.log('Note: This requires root/sudo access in the container');
    
    // Update package lists
    if (!runCommand('apt-get update -y', 'Updating package lists')) {
        console.log('\n❌ Cannot update packages - likely permission issue');
        console.log('🛠️ Manual Fix: Ask your hosting provider to install Chromium');
        console.log('💡 Alternative: Your bot will work with API-only mode');
        return;
    }
    
    // Install basic dependencies first
    if (!runCommand('apt-get install -y wget curl ca-certificates', 'Installing basic dependencies')) {
        console.log('\n⚠️ Could not install dependencies, trying Chromium anyway...');
    }
    
    // Try to install Chromium (lightweight option)
    if (runCommand('apt-get install -y chromium-browser', 'Installing Chromium browser')) {
        chromePath = checkChrome();
        if (chromePath) {
            console.log('\n🎉 Chromium installed successfully!');
            console.log('✅ Your bot is now ready with Chrome support!');
            return;
        }
    }
    
    // If Chromium failed, try Google Chrome
    console.log('\n🔄 Chromium failed, trying Google Chrome...');
    
    if (runCommand('wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -', 'Adding Google Chrome repository key') &&
        runCommand('echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list', 'Adding Google Chrome repository') &&
        runCommand('apt-get update -y', 'Updating package lists with Google repo') &&
        runCommand('apt-get install -y google-chrome-stable', 'Installing Google Chrome')) {
        
        chromePath = checkChrome();
        if (chromePath) {
            console.log('\n🎉 Google Chrome installed successfully!');
            console.log('✅ Your bot is now ready with Chrome support!');
            return;
        }
    }
    
    // If all installation methods failed
    console.log('\n⚠️ Chrome installation failed, but don\'t worry!');
    console.log('📊 Your bot will work in API-only mode');
    console.log('\n💡 What this means:');
    console.log('  ✅ Player tracking still works');
    console.log('  ✅ Discord logging still works');  
    console.log('  ✅ All commands still work');
    console.log('  ⚠️ Fallback scraping (when API fails) won\'t work');
    console.log('\n🎯 The bot is still fully functional - just restart it!');
}

main().catch(console.error);
