const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

// Import the same extraction logic from the bot
console.log('🔍 Debug: Testing player extraction logic...');

// Chrome-free API fallback
async function extractPlayersViaAPI(serverId) {
    console.log(`🌐 Testing API fallback for server: ${serverId}`);
    
    try {
        const axios = require('axios');
        const response = await axios.get(`https://servers.fivem.net/api/servers/single/${serverId}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': `https://servers.fivem.net/servers/detail/${serverId}`,
                'Origin': 'https://servers.fivem.net'
            }
        });
        
        // Check if we got HTML instead of JSON (API blocked)
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.log('❌ API returned HTML instead of JSON - likely blocked');
            throw new Error('API blocked - returning HTML instead of JSON');
        }
        
        if (response.data && response.data.Data && response.data.Data.players) {
            const players = response.data.Data.players
                .map(p => p.name || p)
                .filter(name => name && typeof name === 'string');
            
            return {
                players: players,
                serverInfo: {
                    clients: response.data.Data.clients || 0,
                    maxClients: response.data.Data.sv_maxclients || 0,
                    hostname: response.data.Data.hostname || 'Unknown'
                }
            };
        }
        
        return { players: [], serverInfo: { clients: 0, maxClients: 0, hostname: 'Unknown' } };
        
    } catch (error) {
        console.log(`❌ API fallback failed: ${error.message}`);
        throw error;
    }
}

async function testExtraction() {
    const serverId = 'pz8m77';
    
    // Test API first
    try {
        console.log('🧪 Testing API extraction...');
        const apiResult = await extractPlayersViaAPI(serverId);
        console.log(`✅ API Success: ${apiResult.players.length} players`);
        console.log('👥 Sample players:', apiResult.players.slice(0, 5));
        return apiResult;
    } catch (apiError) {
        console.log(`⚠️ API failed: ${apiError.message}`);
        console.log('🔄 Falling back to Puppeteer...');
    }
    
    // Test Puppeteer fallback
    let browser;
    try {
        console.log('🚀 Testing Puppeteer extraction...');
        
        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };
        
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Monitor API calls for player data
        await page.setRequestInterception(true);
        let playerApiData = null;
        
        page.on('request', (request) => {
            request.continue();
        });
        
        page.on('response', async (response) => {
            if (response.url().includes('api/servers/single/') && response.url().includes(serverId)) {
                try {
                    playerApiData = await response.json();
                    console.log('🎯 Intercepted API data in Puppeteer!');
                } catch (e) {
                    console.log('❌ Could not parse API response in Puppeteer');
                }
            }
        });
        
        await page.goto(`https://servers.fivem.net/servers/detail/${serverId}`, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        await page.waitForTimeout(10000);
        await browser.close();
        
        // Extract player names from API data
        let currentPlayers = [];
        if (playerApiData && playerApiData.Data && playerApiData.Data.players) {
            currentPlayers = playerApiData.Data.players
                .map(p => p.name || p)
                .filter(name => name && typeof name === 'string')
                .filter(name => {
                    const uiElements = [
                        'github', 'forum', 'docs', 'portal', 'terms', 'privacy', 'support',
                        'connect', 'server', 'admin', 'owner', 'staff', 'moderator',
                        'website', 'discord', 'support', 'help', 'about', 'contact'
                    ];
                    return !uiElements.some(element => name.toLowerCase().includes(element));
                });
            
            console.log(`✅ Puppeteer Success: ${currentPlayers.length} players`);
            console.log('👥 Sample players:', currentPlayers.slice(0, 5));
            
            return {
                players: currentPlayers,
                serverInfo: {
                    clients: playerApiData.Data.clients || 0,
                    maxClients: playerApiData.Data.sv_maxclients || 0,
                    hostname: playerApiData.Data.hostname || 'Unknown'
                }
            };
        } else {
            console.log('❌ No player data found in Puppeteer');
            return { players: [], error: 'No player data intercepted' };
        }
        
    } catch (error) {
        console.log(`❌ Puppeteer extraction failed: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message };
    }
}

// Run the test
testExtraction().then(result => {
    console.log('\n🎯 FINAL RESULT:');
    console.log('Players found:', result.players?.length || 0);
    console.log('Error:', result.error || 'None');
    if (result.players?.length > 0) {
        console.log('✅ Extraction working correctly!');
    } else {
        console.log('❌ Extraction not working - needs debugging');
    }
}).catch(error => {
    console.log('❌ Test failed:', error.message);
});
