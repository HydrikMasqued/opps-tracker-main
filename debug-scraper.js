const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const SERVER_ID = 'pz8m77';
const SERVER_URL = `https://servers.fivem.net/servers/detail/${SERVER_ID}`;

async function debugScraping() {
    console.log('🔍 Starting debug analysis...');
    console.log(`URL: ${SERVER_URL}`);
    
    try {
        const response = await axios.get(SERVER_URL, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });
        
        console.log(`✅ Response Status: ${response.status}`);
        console.log(`📊 Response Length: ${response.data.length} characters`);
        
        // Save full HTML for analysis
        fs.writeFileSync('debug-page.html', response.data);
        console.log('💾 Full HTML saved to debug-page.html');
        
        // Load with Cheerio
        const $ = cheerio.load(response.data);
        
        // Check if it's a Cloudflare challenge page
        if (response.data.includes('Just a moment') || response.data.includes('cf-challenge')) {
            console.log('🚫 CLOUDFLARE PROTECTION DETECTED!');
            console.log('📝 First 500 chars:', response.data.substring(0, 500));
            return;
        }
        
        // Analyze page structure
        console.log('\n🔍 PAGE ANALYSIS:');
        console.log(`Title: ${$('title').text()}`);
        console.log(`Body classes: ${$('body').attr('class')}`);
        console.log(`Total elements: ${$('*').length}`);
        
        // Look for player-related text patterns
        const playerPatterns = [
            /player/gi,
            /\d+\/\d+/g,
            /online/gi,
            /name/gi
        ];
        
        console.log('\n📋 SEARCHING FOR PLAYER PATTERNS:');
        playerPatterns.forEach((pattern, index) => {
            const matches = response.data.match(pattern);
            if (matches) {
                console.log(`Pattern ${index + 1} (${pattern}): Found ${matches.length} matches`);
                console.log(`First few matches:`, matches.slice(0, 5));
            }
        });
        
        // Look for JSON data
        console.log('\n🔍 SEARCHING FOR JSON DATA:');
        const jsonPatterns = [
            /"players":\s*\[([^\]]+)\]/g,
            /"clients":\s*(\d+)/g,
            /"name":\s*"([^"]+)"/g,
            /window\.__INITIAL_STATE__\s*=\s*({.*?});/g,
            /window\.serverData\s*=\s*({.*?});/g
        ];
        
        jsonPatterns.forEach((pattern, index) => {
            let match;
            let count = 0;
            while ((match = pattern.exec(response.data)) !== null && count < 3) {
                console.log(`JSON Pattern ${index + 1}:`, match[0].substring(0, 100));
                count++;
            }
        });
        
        // Look for specific selectors
        console.log('\n🎯 TESTING COMMON SELECTORS:');
        const testSelectors = [
            '.player',
            '.player-name',
            '.players',
            '[data-player]',
            '.server-info',
            '.online-players',
            '.player-list',
            '#players',
            '.user',
            '.username'
        ];
        
        testSelectors.forEach(selector => {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`✅ ${selector}: Found ${elements.length} elements`);
                elements.each((i, el) => {
                    if (i < 3) { // Show first 3
                        console.log(`  - Text: "${$(el).text().trim()}"`);
                        console.log(`  - HTML: ${$(el).html()?.substring(0, 100)}...`);
                    }
                });
            } else {
                console.log(`❌ ${selector}: Not found`);
            }
        });
        
        // Look for script tags that might contain data
        console.log('\n📜 ANALYZING SCRIPT TAGS:');
        $('script').each((i, script) => {
            const scriptContent = $(script).html();
            if (scriptContent && (scriptContent.includes('player') || scriptContent.includes('name'))) {
                console.log(`Script ${i + 1} (contains player/name data):`);
                console.log(scriptContent.substring(0, 200) + '...');
            }
        });
        
        // Extract any numbers that look like player counts
        console.log('\n🔢 LOOKING FOR PLAYER COUNTS:');
        const numberPatterns = [
            /(\d+)\/(\d+)\s*players?/gi,
            /(\d+)\s*\/\s*(\d+)/g,
            /players?.*?(\d+)/gi,
            /online.*?(\d+)/gi
        ];
        
        numberPatterns.forEach((pattern, index) => {
            let match;
            while ((match = pattern.exec(response.data)) !== null) {
                console.log(`Number Pattern ${index + 1}:`, match[0]);
            }
        });
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugScraping();
