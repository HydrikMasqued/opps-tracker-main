const axios = require('axios');
const { installChrome } = require('./install-chrome.js');

async function testSetup() {
    console.log('🧪 Testing OPPS Tracker Setup...\n');
    
    // Test 1: Node.js version
    console.log(`📋 Node.js version: ${process.version}`);
    
    // Test 2: Test API access (Chrome-free)
    console.log('\n🌐 Testing FiveM API access (Chrome-free method)...');
    try {
        const response = await axios.get('https://servers.fivem.net/api/servers/single/pz8m77', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (response.data && response.data.Data) {
            console.log(`✅ API test successful!`);
            console.log(`   Server: ${response.data.Data.hostname || 'Unknown'}`);
            console.log(`   Players: ${response.data.Data.clients}/${response.data.Data.sv_maxclients}`);
        } else {
            console.log('⚠️ API responded but no data received');
        }
    } catch (error) {
        console.log(`❌ API test failed: ${error.message}`);
    }
    
    // Test 3: Chrome/Puppeteer availability
    console.log('\n🚀 Testing Chrome/Puppeteer availability...');
    try {
        await installChrome();
    } catch (error) {
        console.log(`⚠️ Chrome test failed: ${error.message}`);
    }
    
    // Test 4: Discord.js
    console.log('\n🤖 Testing Discord.js...');
    try {
        const { Client } = require('discord.js');
        console.log('✅ Discord.js loaded successfully');
    } catch (error) {
        console.log(`❌ Discord.js test failed: ${error.message}`);
    }
    
    console.log('\n🎯 Setup Test Complete!');
    console.log('💡 The bot should work even if Chrome tests fail - API fallback is available.');
}

testSetup().catch(console.error);
