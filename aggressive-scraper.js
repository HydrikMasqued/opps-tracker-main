const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
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

// Method 1: Aggressive Axios + Cheerio scraping with multiple selectors
async function scrapePlayers_Cheerio() {
    console.log('🕷️ Method 1: Cheerio scraping...');
    
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
    ];
    
    for (const userAgent of userAgents) {
        try {
            const response = await axios.get(SERVER_URL, {
                timeout: 15000,
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }
            });
            
            const $ = cheerio.load(response.data);
            const players = [];
            
            // Multiple selector strategies for finding player names
            const selectors = [
                '.player-name',
                '.player .name',
                '[data-player-name]',
                '.players-list .player',
                '.server-players .player',
                '.player-row .name',
                '.players .player-name',
                '.online-players .player',
                '[class*="player"] [class*="name"]',
                '.player-info .name',
                '.player-entry .name'
            ];
            
            // Try each selector
            for (const selector of selectors) {
                $(selector).each((i, element) => {
                    const name = $(element).text().trim();
                    if (name && name.length > 0 && !players.includes(name)) {
                        players.push(name);
                    }
                });
            }
            
            // Additional regex-based extraction from HTML
            const htmlContent = response.data;
            const patterns = [
                /"playerName":\s*"([^"]+)"/g,
                /"name":\s*"([^"]+)"/g,
                /player.*?name.*?["']([^"']+)["']/gi,
                /name.*?["']([^"']+)["'].*?player/gi,
                /<[^>]*player[^>]*>([^<]+)<\/[^>]*>/gi,
                /\{"name":"([^"]+)"/g
            ];
            
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(htmlContent)) !== null) {
                    const name = match[1].trim();
                    if (name && name.length > 0 && !players.includes(name) && !name.includes('<') && !name.includes('>')) {
                        players.push(name);
                    }
                }
            });
            
            if (players.length > 0) {
                console.log(`✅ Cheerio method found ${players.length} players`);
                return players;
            }
            
        } catch (error) {
            console.log(`❌ Cheerio failed with ${userAgent}: ${error.message}`);
        }
    }
    
    return [];
}

// Method 2: Puppeteer browser automation for JavaScript-heavy pages
async function scrapePlayers_Puppeteer() {
    console.log('🤖 Method 2: Puppeteer scraping...');
    
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
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set realistic browser characteristics
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navigate to page and wait for content
        await page.goto(SERVER_URL, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait for potential dynamic content loading
        await page.waitForTimeout(3000);
        
        // Extract player names using multiple strategies
        const players = await page.evaluate(() => {
            const playerNames = [];
            
            // Strategy 1: Common selectors
            const selectors = [
                '.player-name',
                '.player .name',
                '[data-player-name]',
                '.players-list .player',
                '.server-players .player',
                '.player-row .name',
                '.players .player-name',
                '.online-players .player',
                '.player-info .name',
                '.player-entry .name'
            ];
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    const name = element.textContent.trim();
                    if (name && !playerNames.includes(name)) {
                        playerNames.push(name);
                    }
                });
            });
            
            // Strategy 2: Look for any element containing "player" and extract text
            document.querySelectorAll('*').forEach(element => {
                const className = element.className.toLowerCase();
                const id = element.id.toLowerCase();
                
                if ((className.includes('player') || id.includes('player')) && 
                    element.textContent && element.textContent.trim().length > 0 &&
                    element.textContent.trim().length < 50) {
                    
                    const text = element.textContent.trim();
                    if (!playerNames.includes(text) && !text.includes('Players') && !text.includes('Server')) {
                        playerNames.push(text);
                    }
                }
            });
            
            // Strategy 3: Look in window objects and global variables
            const globalVars = ['players', 'playerList', 'serverPlayers', 'onlinePlayers'];
            globalVars.forEach(varName => {
                if (window[varName] && Array.isArray(window[varName])) {
                    window[varName].forEach(player => {
                        if (typeof player === 'string') {
                            if (!playerNames.includes(player)) playerNames.push(player);
                        } else if (player && player.name) {
                            if (!playerNames.includes(player.name)) playerNames.push(player.name);
                        }
                    });
                }
            });
            
            return playerNames;
        });
        
        await browser.close();
        
        if (players.length > 0) {
            console.log(`✅ Puppeteer method found ${players.length} players`);
            return players;
        }
        
    } catch (error) {
        console.log(`❌ Puppeteer failed: ${error.message}`);
        if (browser) await browser.close();
    }
    
    return [];
}

// Method 3: Raw HTML analysis with advanced pattern matching
async function scrapePlayers_RawHTML() {
    console.log('📝 Method 3: Raw HTML analysis...');
    
    try {
        const response = await axios.get(SERVER_URL, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const html = response.data;
        const players = [];
        
        // Advanced regex patterns for extracting names
        const patterns = [
            // JSON patterns
            /"players":\s*\[([^\]]+)\]/g,
            /"playerName":\s*"([^"]+)"/g,
            /"displayName":\s*"([^"]+)"/g,
            /"username":\s*"([^"]+)"/g,
            /"name":\s*"([^"]+)"/g,
            
            // HTML patterns
            /<span[^>]*class="[^"]*player[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/gi,
            /<div[^>]*class="[^"]*player[^"]*"[^>]*>([^<]+)<\/div>/gi,
            /<li[^>]*class="[^"]*player[^"]*"[^>]*>([^<]+)<\/li>/gi,
            
            // Data attribute patterns
            /data-player-name="([^"]+)"/gi,
            /data-name="([^"]+)"/gi,
            /data-username="([^"]+)"/gi,
            
            // Script variable patterns
            /players\s*=\s*\[([^\]]+)\]/gi,
            /playerList\s*=\s*\[([^\]]+)\]/gi,
            
            // General patterns
            /player[^>]*>([A-Za-z0-9_\-\s]{2,30})</gi,
            /"([A-Za-z0-9_\-\s]{3,25})"[^>]*player/gi
        ];
        
        patterns.forEach((pattern, index) => {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                let playerName = match[1];
                
                // Clean up the extracted name
                playerName = playerName.replace(/['"]/g, '').trim();
                
                // Validate the player name
                if (playerName && 
                    playerName.length >= 2 && 
                    playerName.length <= 30 && 
                    !playerName.includes('<') && 
                    !playerName.includes('>') &&
                    !playerName.includes('{') &&
                    !playerName.includes('}') &&
                    !playerName.toLowerCase().includes('server') &&
                    !playerName.toLowerCase().includes('player') &&
                    !players.includes(playerName)) {
                    
                    players.push(playerName);
                }
            }
        });
        
        if (players.length > 0) {
            console.log(`✅ Raw HTML method found ${players.length} players`);
            return players;
        }
        
    } catch (error) {
        console.log(`❌ Raw HTML analysis failed: ${error.message}`);
    }
    
    return [];
}

// Main function to get player names using all methods
async function getPlayerNames() {
    console.log(`🎯 Starting aggressive scraping for server: ${SERVER_ID}`);
    
    let allPlayers = [];
    
    // Try all methods and combine results
    const methods = [
        scrapePlayers_Cheerio,
        scrapePlayers_Puppeteer,
        scrapePlayers_RawHTML
    ];
    
    for (const method of methods) {
        try {
            const players = await method();
            if (players && players.length > 0) {
                // Merge unique players
                players.forEach(player => {
                    if (!allPlayers.includes(player)) {
                        allPlayers.push(player);
                    }
                });
            }
        } catch (error) {
            console.log(`Method failed: ${error.message}`);
        }
    }
    
    // Clean and validate final list
    allPlayers = allPlayers.filter(player => 
        player && 
        typeof player === 'string' && 
        player.trim().length > 0 &&
        player.length <= 50
    );
    
    console.log(`🎮 Total unique players found: ${allPlayers.length}`);
    return allPlayers;
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎮 Aggressive scraper ready for server: ${SERVER_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    
    if (content === '!players' || content === '!scrape' || content === '!list') {
        const loadingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔄 Scraping Player List...')
            .setDescription('Aggressively extracting player names from the server page...')
            .setTimestamp();
        
        const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            const playerNames = await getPlayerNames();
            
            if (playerNames.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ No Players Found')
                    .setDescription('Unable to extract any player names from the server page.')
                    .addFields(
                        { name: 'Server ID', value: SERVER_ID, inline: true },
                        { name: 'Methods Tried', value: '• Cheerio Scraping\n• Puppeteer Browser\n• Raw HTML Analysis', inline: false }
                    )
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [errorEmbed] });
            }
            
            // Create player list embed
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 Online Players')
                .setDescription(`Found **${playerNames.length}** players on the server`)
                .setTimestamp();
            
            // Split players into chunks for multiple fields if needed
            const chunkSize = 20;
            for (let i = 0; i < playerNames.length; i += chunkSize) {
                const chunk = playerNames.slice(i, i + chunkSize);
                const fieldName = i === 0 ? 'Player Names' : `Players (${i + 1}-${Math.min(i + chunkSize, playerNames.length)})`;
                embed.addFields({
                    name: fieldName,
                    value: chunk.join('\n') || 'No names extracted',
                    inline: false
                });
            }
            
            embed.setFooter({ text: `Server ID: ${SERVER_ID} | Aggressive Scraping` });
            
            loadingMessage.edit({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error during scraping:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Scraping Error')
                .setDescription('An error occurred during aggressive scraping.')
                .addFields({ name: 'Error Details', value: error.message })
                .setTimestamp();
            
            loadingMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    if (content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🕷️ Aggressive FiveM Player Scraper')
            .setDescription('Extreme accuracy player name extraction')
            .addFields(
                { name: '!players', value: 'Extract all player names', inline: true },
                { name: '!scrape', value: 'Same as !players', inline: true },
                { name: '!list', value: 'Same as !players', inline: true },
                { name: '!help', value: 'Show this help message', inline: true }
            )
            .addFields({
                name: '🔧 Scraping Methods',
                value: '• Cheerio HTML Parsing\n• Puppeteer Browser Automation\n• Raw HTML Pattern Matching\n• Multiple User Agents\n• Advanced Regex Extraction',
                inline: false
            })
            .setFooter({ text: 'Aggressive Player Scraper v1.0' })
            .setTimestamp();
        
        message.reply({ embeds: [helpEmbed] });
    }
});

client.on('error', console.error);
client.login(process.env.DISCORD_TOKEN);
