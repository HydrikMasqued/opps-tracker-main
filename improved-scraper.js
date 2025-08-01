const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const SERVER_ID = 'pz8m77';
const SERVER_URL = `https://servers.fivem.net/servers/detail/${SERVER_ID}`;

// Aggressive Puppeteer scraper specifically for JavaScript-heavy FiveM pages
async function scrapePlayersWithPuppeteer() {
    console.log('🤖 Starting Puppeteer scraping for JavaScript-loaded content...');
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set realistic browser characteristics
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Enable request interception to monitor network calls
        await page.setRequestInterception(true);
        const apiCalls = [];
        
        page.on('request', (request) => {
            if (request.url().includes('api') || request.url().includes('server')) {
                apiCalls.push(request.url());
                console.log(`📡 API Call detected: ${request.url()}`);
            }
            request.continue();
        });
        
        page.on('response', async (response) => {
            if (response.url().includes('api') && response.url().includes(SERVER_ID)) {
                console.log(`📥 API Response: ${response.url()} - Status: ${response.status()}`);
                try {
                    const responseData = await response.json();
                    console.log('📊 API Data preview:', JSON.stringify(responseData).substring(0, 200));
                } catch (e) {
                    console.log('❌ Could not parse API response as JSON');
                }
            }
        });
        
        console.log(`🌐 Navigating to: ${SERVER_URL}`);
        await page.goto(SERVER_URL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        console.log('⏳ Waiting for content to load...');
        
        // Wait for the React app to load and render content
        await page.waitForTimeout(8000);
        
        // Try to wait for specific elements that indicate the page is loaded
        const possibleSelectors = [
            '[data-testid="server-detail"]',
            '[class*="server"]',
            '[class*="player"]',
            '[class*="detail"]',
            '.server-info',
            '.player-list',
            '[data-cy="players"]'
        ];
        
        let contentLoaded = false;
        for (const selector of possibleSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                console.log(`✅ Found content selector: ${selector}`);
                contentLoaded = true;
                break;
            } catch (e) {
                console.log(`❌ Selector not found: ${selector}`);
            }
        }
        
        if (!contentLoaded) {
            console.log('⚠️ No specific selectors found, proceeding with general analysis...');
        }
        
        // Additional wait for any remaining dynamic content
        await page.waitForTimeout(3000);
        
        console.log('🔍 Analyzing page content...');
        
        // Get the full HTML after JavaScript execution
        const fullHTML = await page.content();
        console.log(`📊 Full page length after JS: ${fullHTML.length} characters`);
        
        // Extract player names using comprehensive strategies
        const scrapingResults = await page.evaluate(() => {
            const results = {
                players: [],
                serverInfo: {},
                debug: {
                    totalElements: document.querySelectorAll('*').length,
                    bodyText: document.body.textContent.length,
                    foundPatterns: []
                }
            };
            
            console.log('🔍 Starting browser-side extraction...');
            
            // Strategy 1: Look for any text that could be player names
            const allText = document.body.textContent;
            const textNodes = [];
            
            function getTextNodes(node) {
                if (node.nodeType === 3) { // Text node
                    const text = node.textContent.trim();
                    if (text.length > 2 && text.length < 50 && /^[a-zA-Z0-9_\-\s]+$/.test(text)) {
                        textNodes.push(text);
                    }
                } else {
                    for (let child of node.childNodes) {
                        getTextNodes(child);
                    }
                }
            }
            
            getTextNodes(document.body);
            console.log(`Found ${textNodes.length} potential text nodes`);
            
            // Strategy 2: Look for elements with player-related content
            const playerSelectors = [
                '*[class*="player"]',
                '*[class*="name"]',
                '*[class*="user"]',
                '*[data-player]',
                '*[data-name]',
                'li',
                'span',
                'div'
            ];
            
            playerSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text && text.length > 2 && text.length < 50 && 
                            !text.includes('\n') && !text.includes('Server') && 
                            !text.includes('Player') && !text.includes('Online') &&
                            /^[a-zA-Z0-9_\-\s]+$/.test(text)) {
                            
                            if (!results.players.includes(text)) {
                                results.players.push(text);
                            }
                        }
                    });
                } catch (e) {
                    console.log(`Error with selector ${selector}:`, e.message);
                }
            });
            
            // Strategy 3: Look for numbers that might indicate player counts
            const numberMatches = allText.match(/(\d+)\/(\d+)/g);
            if (numberMatches) {
                results.serverInfo.playerCounts = numberMatches;
                results.debug.foundPatterns.push('Player count patterns found');
            }
            
            // Strategy 4: Look for JSON in script tags or window objects
            try {
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    const content = script.textContent;
                    if (content && (content.includes('player') || content.includes('name'))) {
                        // Try to extract JSON data
                        const jsonMatches = content.match(/\{[^{}]*"[^"]*"[^{}]*\}/g);
                        if (jsonMatches) {
                            results.debug.foundPatterns.push('JSON patterns in scripts');
                        }
                    }
                });
            } catch (e) {
                console.log('Error analyzing scripts:', e.message);
            }
            
            // Strategy 5: Check window objects for data
            try {
                const windowKeys = Object.keys(window);
                windowKeys.forEach(key => {
                    if (key.toLowerCase().includes('server') || key.toLowerCase().includes('player')) {
                        results.debug.foundPatterns.push(`Window object: ${key}`);
                    }
                });
            } catch (e) {
                console.log('Error checking window objects:', e.message);
            }
            
            // Filter and clean player names
            results.players = results.players.filter(player => {
                return player && 
                       typeof player === 'string' && 
                       player.length >= 3 && 
                       player.length <= 30 &&
                       !player.toLowerCase().includes('server') &&
                       !player.toLowerCase().includes('detail') &&
                       !player.toLowerCase().includes('list') &&
                       !player.toLowerCase().includes('online') &&
                       !/^\d+$/.test(player); // Not just numbers
            });
            
            // Remove duplicates
            results.players = [...new Set(results.players)];
            
            console.log(`Found ${results.players.length} potential players`);
            console.log('Debug info:', results.debug);
            
            return results;
        });
        
        await browser.close();
        
        console.log(`🎮 Extraction complete:`);
        console.log(`- Total elements: ${scrapingResults.debug.totalElements}`);
        console.log(`- Body text length: ${scrapingResults.debug.bodyText}`);
        console.log(`- Found patterns: ${scrapingResults.debug.foundPatterns.join(', ')}`);
        console.log(`- Player candidates: ${scrapingResults.players.length}`);
        console.log(`- Players found: ${scrapingResults.players.join(', ')}`);
        
        if (scrapingResults.serverInfo.playerCounts) {
            console.log(`- Player counts detected: ${scrapingResults.serverInfo.playerCounts.join(', ')}`);
        }
        
        console.log(`📊 API calls made: ${apiCalls.join(', ')}`);
        
        return {
            players: scrapingResults.players,
            serverInfo: scrapingResults.serverInfo,
            debug: scrapingResults.debug,
            apiCalls: apiCalls
        };
        
    } catch (error) {
        console.log(`❌ Puppeteer scraping failed: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message };
    }
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎮 Improved aggressive scraper ready for server: ${SERVER_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    
    if (content === '!players' || content === '!scrape' || content === '!list' || content === '!debug') {
        const loadingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔄 Advanced Scraping in Progress...')
            .setDescription('Using Puppeteer to load JavaScript content and extract player names...\n\nThis may take 30-60 seconds.')
            .setTimestamp();
        
        const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            const results = await scrapePlayersWithPuppeteer();
            
            if (results.error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Scraping Error')
                    .setDescription('Error occurred during JavaScript scraping.')
                    .addFields({ name: 'Error Details', value: results.error })
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [errorEmbed] });
            }
            
            if (results.players.length === 0) {
                const noPlayersEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ No Player Names Found')
                    .setDescription('Advanced scraping completed but no player names were extracted.')
                    .addFields(
                        { name: 'Debug Info', value: `Elements: ${results.debug.totalElements}\nBody Text: ${results.debug.bodyText} chars\nPatterns: ${results.debug.foundPatterns.length}`, inline: false },
                        { name: 'API Calls', value: results.apiCalls.length > 0 ? results.apiCalls.join('\n') : 'None detected', inline: false }
                    );
                
                if (results.serverInfo.playerCounts) {
                    noPlayersEmbed.addFields({ name: 'Player Counts Found', value: results.serverInfo.playerCounts.join(', '), inline: false });
                }
                    
                noPlayersEmbed.setTimestamp();
                
                return loadingMessage.edit({ embeds: [noPlayersEmbed] });
            }
            
            // Success - display found players
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 Players Found!')
                .setDescription(`Successfully extracted **${results.players.length}** player names`)
                .setTimestamp();
            
            // Split players into chunks for multiple fields if needed
            const chunkSize = 20;
            for (let i = 0; i < results.players.length; i += chunkSize) {
                const chunk = results.players.slice(i, i + chunkSize);
                const fieldName = i === 0 ? 'Player Names' : `Players (${i + 1}-${Math.min(i + chunkSize, results.players.length)})`;
                embed.addFields({
                    name: fieldName,
                    value: chunk.join('\n'),
                    inline: false
                });
            }
            
            // Add debug info if requested
            if (content.includes('debug')) {
                embed.addFields(
                    { name: 'Debug Info', value: `Elements: ${results.debug.totalElements}\nPatterns: ${results.debug.foundPatterns.join(', ')}`, inline: false },
                    { name: 'API Calls', value: results.apiCalls.length > 0 ? results.apiCalls.slice(0, 3).join('\n') : 'None', inline: false }
                );
            }
            
            embed.setFooter({ text: `Server ID: ${SERVER_ID} | Advanced JS Scraping` });
            
            loadingMessage.edit({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error during improved scraping:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred during advanced scraping.')
                .addFields({ name: 'Error Details', value: error.message })
                .setTimestamp();
            
            loadingMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    if (content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🤖 Advanced FiveM Player Scraper')
            .setDescription('JavaScript-aware extreme accuracy player extraction')
            .addFields(
                { name: '!players', value: 'Extract player names with JS loading', inline: true },
                { name: '!scrape', value: 'Same as !players', inline: true },
                { name: '!list', value: 'Same as !players', inline: true },
                { name: '!debug', value: 'Players + detailed debug info', inline: true },
                { name: '!help', value: 'Show this help message', inline: true }
            )
            .addFields({
                name: '🔧 Advanced Features',
                value: '• Full JavaScript Execution\n• Network Request Monitoring\n• Dynamic Content Loading\n• Multiple Extraction Strategies\n• Real Browser Simulation',
                inline: false
            })
            .setFooter({ text: 'Advanced Player Scraper v2.0' })
            .setTimestamp();
        
        message.reply({ embeds: [helpEmbed] });
    }
});

client.on('error', console.error);
client.login(process.env.DISCORD_TOKEN);
