const puppeteer = require('puppeteer');
const axios = require('axios');

async function testExtraction() {
    console.log('🧪 Testing Royalty RP extraction...');
    
    // Try API first
    try {
        console.log('🌐 Testing API method...');
        const response = await axios.get('https://servers.fivem.net/api/servers/single/pz8m77', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.log('❌ API returned HTML instead of JSON - likely blocked');
            throw new Error('API blocked');
        }
        
        if (response.data && response.data.Data && response.data.Data.players) {
            const players = response.data.Data.players
                .map(p => p.name || p)
                .filter(name => name && typeof name === 'string');
            console.log(`✅ API Success: Found ${players.length} players`);
            console.log('First 5 players:', players.slice(0, 5));
            return;
        }
    } catch (error) {
        console.log(`❌ API failed: ${error.message}`);
    }
    
    // Try Puppeteer
    console.log('🤖 Testing Puppeteer method...');
    let browser;
    try {
        const executablePath = 'C:\\Users\\Jayt1\\Opps Tracker Main\\.cache\\puppeteer\\chrome\\win64-121.0.6167.85\\chrome-win64\\chrome.exe';
        
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        let playerApiData = null;
        
        // Enable request interception
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            request.continue();
        });
        
        // Monitor API responses
        page.on('response', async (response) => {
            if (response.url().includes('api/servers/single/') && response.url().includes('pz8m77')) {
                try {
                    playerApiData = await response.json();
                    console.log('📡 Intercepted API data with players:', playerApiData?.Data?.players?.length || 0);
                } catch (e) {
                    console.log('❌ Could not parse intercepted API response');
                }
            }
        });
        
        console.log('🌐 Navigating to FiveM page...');
        await page.goto('https://servers.fivem.net/servers/detail/pz8m77', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });
        
        console.log('⏳ Waiting for data to load...');
        await page.waitForTimeout(8000);
        
        if (playerApiData && playerApiData.Data && playerApiData.Data.players) {
            const players = playerApiData.Data.players
                .map(p => p.name || p)
                .filter(name => name && typeof name === 'string');
            console.log(`✅ Puppeteer Success: Found ${players.length} players`);
            console.log('First 10 players:', players.slice(0, 10));
            console.log('Server info:', {
                hostname: playerApiData.Data.hostname,
                clients: playerApiData.Data.clients,
                maxClients: playerApiData.Data.sv_maxclients
            });
        } else {
            console.log('❌ No player data found with Puppeteer');
            console.log('playerApiData exists:', !!playerApiData);
            if (playerApiData) {
                console.log('playerApiData.Data exists:', !!playerApiData.Data);
                if (playerApiData.Data) {
                    console.log('playerApiData.Data.players exists:', !!playerApiData.Data.players);
                }
            }
        }
        
    } catch (error) {
        console.log(`❌ Puppeteer failed: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

testExtraction().catch(console.error);
