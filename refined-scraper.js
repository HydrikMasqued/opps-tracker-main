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

// Refined scraper focused on extracting ONLY player names with extreme accuracy
async function extractPlayerNamesOnly() {
    console.log('🎯 Starting refined player name extraction...');
    
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
        
        // Monitor API calls for direct data extraction
        await page.setRequestInterception(true);
        let playerApiData = null;
        
        page.on('request', (request) => {
            request.continue();
        });
        
        page.on('response', async (response) => {
            if (response.url().includes('api/servers/single/') && response.url().includes(SERVER_ID)) {
                console.log(`📥 Capturing API data from: ${response.url()}`);
                try {
                    playerApiData = await response.json();
                    console.log(`📊 API Response captured: ${JSON.stringify(playerApiData).substring(0, 300)}...`);
                } catch (e) {
                    console.log('❌ Could not parse API response');
                }
            }
        });
        
        console.log(`🌐 Loading page: ${SERVER_URL}`);
        await page.goto(SERVER_URL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        console.log('⏳ Waiting for content and API calls...');
        await page.waitForTimeout(10000);
        
        // Extract player names with refined filtering
        const extractedPlayers = await page.evaluate(() => {
            console.log('🔍 Starting refined extraction...');
            
            const playerNames = [];
            const excludePatterns = [
                /^(server|connect|resources?|tags?|show|all|mode|pure|l1|fivem|royalty|roleplay|discord|find|us|owner|admin|mod|staff)$/i,
                /^(window|object|function|undefined|null|true|false|class|style|script|div|span|body|html)$/i,
                /^(\d+f?_|2vd_|17mov_|\d+$)/i, // Resource patterns
                /^(https?:|www\.|\.com|\.net|\.org|@)/i, // URL patterns
                /^[0-9\-_\s]*$/,  // Only numbers/symbols
                /deployer|qbox|resource|script|mod/i
            ];
            
            // Get all text elements
            const allElements = document.querySelectorAll('*');
            const textCollection = new Set();
            
            allElements.forEach(element => {
                const text = element.textContent.trim();
                
                // Only get direct text content, not nested
                if (element.children.length === 0 && text) {
                    textCollection.add(text);
                }
            });
            
            console.log(`Found ${textCollection.size} unique text elements`);
            
            // Filter for likely player names
            Array.from(textCollection).forEach(text => {
                // Basic validation
                if (text.length >= 3 && text.length <= 30) {
                    
                    // Check against exclude patterns
                    let isExcluded = false;
                    for (const pattern of excludePatterns) {
                        if (pattern.test(text)) {
                            isExcluded = true;
                            break;
                        }
                    }
                    
                    if (!isExcluded) {
                        // Check if it looks like a player name (has valid characters)
                        if (/^[a-zA-Z0-9\s_\-\.]+$/.test(text) && 
                            !/^\d+$/.test(text) && 
                            !text.includes('http') &&
                            !text.includes('www') &&
                            !text.includes('.com') &&
                            !text.includes('discord') &&
                            text !== 'Connect' &&
                            text !== 'Server' &&
                            text !== 'Online' &&
                            text !== 'Players') {
                            
                            playerNames.push(text);
                        }
                    }
                }
            });
            
            // Remove duplicates and sort
            const uniquePlayers = [...new Set(playerNames)].sort();
            
            console.log(`Filtered to ${uniquePlayers.length} potential player names`);
            console.log('Sample players:', uniquePlayers.slice(0, 10));
            
            return uniquePlayers;
        });
        
        await browser.close();
        
        console.log(`🎮 Refined extraction complete:`);
        console.log(`- Found ${extractedPlayers.length} potential player names`);
        
        // Final filtering based on common sense patterns
        const finalPlayers = extractedPlayers.filter(name => {
            // Must have at least one letter
            if (!/[a-zA-Z]/.test(name)) return false;
            
            // Common server-related words to exclude
            const serverWords = ['server', 'connect', 'online', 'players', 'resources', 'tags', 'show', 'all', 'pure', 'mode', 'fivem', 'royalty', 'roleplay', 'owner', 'admin'];
            if (serverWords.some(word => name.toLowerCase().includes(word))) return false;
            
            // Resource naming patterns
            if (/^\d+[a-z_\-]+/.test(name) || /^[a-z]+_[a-z]+$/.test(name.toLowerCase())) return false;
            
            // Too generic
            if (['L1', 'OneSync', 'FiveM', 'Connect', 'Resources', 'Tags'].includes(name)) return false;
            
            return true;
        });
        
        console.log(`🎯 Final filtered players: ${finalPlayers.length}`);
        console.log(`📋 Player names: ${finalPlayers.join(', ')}`);
        
        // Extract ONLY from API data (this contains the actual player list)
        let apiPlayers = [];
        if (playerApiData && playerApiData.Data && playerApiData.Data.players) {
            apiPlayers = playerApiData.Data.players.map(p => p.name || p).filter(name => name && typeof name === 'string');
            console.log(`📡 API extracted ${apiPlayers.length} players: ${apiPlayers.join(', ')}`);
        }
        
        // ONLY use API data - ignore web scraping to avoid UI elements
        const cleanedApiPlayers = apiPlayers.filter(name => {
            // Filter out obvious UI/system elements that might leak into API
            const uiElements = [
                'github', 'forum', 'docs', 'portal', 'terms', 'privacy', 'support',
                'connect', 'server', 'admin', 'owner', 'staff', 'moderator',
                'website', 'discord', 'support', 'help', 'about', 'contact'
            ];
            
            return !uiElements.some(element => name.toLowerCase().includes(element));
        });
        
        console.log(`🎯 Cleaned API players: ${cleanedApiPlayers.length}`);
        console.log(`📋 Final player names: ${cleanedApiPlayers.join(', ')}`);
        
        return {
            players: cleanedApiPlayers, // ONLY use cleaned API data
            webPlayers: [], // Don't use web scraping results
            apiPlayers: cleanedApiPlayers,
            serverInfo: {
                clients: playerApiData?.Data?.clients || 0,
                maxClients: playerApiData?.Data?.sv_maxclients || 0,
                hostname: playerApiData?.Data?.hostname || 'Unknown'
            }
        };
        
    } catch (error) {
        console.log(`❌ Refined scraping failed: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message };
    }
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎯 Refined player name scraper ready for server: ${SERVER_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    
    if (content === '!players' || content === '!names' || content === '!list') {
        const loadingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🎯 Extracting Player Names...')
            .setDescription('Refined extraction focusing only on actual player names...\n\n*This may take 30-60 seconds*')
            .setTimestamp();
        
        const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            const results = await extractPlayerNamesOnly();
            
            if (results.error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Extraction Error')
                    .setDescription('Error occurred during player name extraction.')
                    .addFields({ name: 'Error Details', value: results.error })
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [errorEmbed] });
            }
            
            if (results.players.length === 0) {
                const noPlayersEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ No Player Names Found')
                    .setDescription('Refined extraction completed but no player names were found.')
                    .addFields(
                        { name: 'Server Info', value: `**${results.serverInfo.hostname}**\n${results.serverInfo.clients}/${results.serverInfo.maxClients} players`, inline: false }
                    )
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [noPlayersEmbed] });
            }
            
            // Success - display found players
            const cleanHostname = results.serverInfo.hostname.replace(/\^\d/g, '').replace(/\|.*$/, '').trim();
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 Online Players')
                .setDescription(`**${cleanHostname}**`)
                .setTimestamp();
            
            // Add player counter at the top
            embed.addFields({
                name: '👥 Players Online',
                value: `**${results.players.length}** out of **${results.serverInfo.maxClients}** slots`,
                inline: false
            });
            
            // Create one complete list of all players
            const playerList = results.players.join('\n');
            
            // Discord has a 1024 character limit per field, so we may need to split
            if (playerList.length <= 1024) {
                embed.addFields({
                    name: '📋 Complete Player List',
                    value: playerList,
                    inline: false
                });
            } else {
                // Split into multiple fields if the list is too long
                const chunkSize = 900; // Leave some buffer
                let currentChunk = '';
                let chunkNumber = 1;
                
                results.players.forEach((player, index) => {
                    const playerLine = player + '\n';
                    
                    if (currentChunk.length + playerLine.length > chunkSize) {
                        // Add current chunk and start new one
                        embed.addFields({
                            name: chunkNumber === 1 ? '📋 Complete Player List' : `📋 Player List (continued)`,
                            value: currentChunk.trim(),
                            inline: false
                        });
                        currentChunk = playerLine;
                        chunkNumber++;
                    } else {
                        currentChunk += playerLine;
                    }
                });
                
                // Add the last chunk
                if (currentChunk.trim()) {
                    embed.addFields({
                        name: chunkNumber === 1 ? '📋 Complete Player List' : `📋 Player List (continued)`,
                        value: currentChunk.trim(),
                        inline: false
                    });
                }
            }
            
            embed.setFooter({ text: `Server ID: ${SERVER_ID} | Refined Extraction` });
            
            loadingMessage.edit({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error during refined extraction:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred during refined extraction.')
                .addFields({ name: 'Error Details', value: error.message })
                .setTimestamp();
            
            loadingMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    if (content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎯 Refined FiveM Player Name Extractor')
            .setDescription('Extreme accuracy extraction focused only on actual player names')
            .addFields(
                { name: '!players', value: 'Extract only player names', inline: true },
                { name: '!names', value: 'Same as !players', inline: true },
                { name: '!list', value: 'Same as !players', inline: true },
                { name: '!help', value: 'Show this help message', inline: true }
            )
            .addFields({
                name: '🎯 Key Features',
                value: '• Filters out server resources\n• Removes system messages\n• Excludes server metadata\n• Combines web + API data\n• Extreme accuracy filtering',
                inline: false
            })
            .setFooter({ text: 'Refined Player Extractor v3.0' })
            .setTimestamp();
        
        message.reply({ embeds: [helpEmbed] });
    }
});

client.on('error', console.error);
client.login(process.env.DISCORD_TOKEN);
