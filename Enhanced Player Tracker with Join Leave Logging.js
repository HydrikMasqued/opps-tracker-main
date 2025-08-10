const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Server configurations
const SERVERS = {
    royalty: {
        id: 'pz8m77',
        name: 'Royalty RP',
        url: 'https://servers.fivem.net/servers/detail/pz8m77'
    },
    horizon: {
        id: 'brqqod',
        name: 'Horizon',
        url: 'https://servers.fivem.net/servers/detail/brqqod'
    }
};

// Default server for monitoring
const SERVER_ID = 'pz8m77';
const SERVER_URL = `https://servers.fivem.net/servers/detail/${SERVER_ID}`;

// Configuration
let LOG_CHANNEL_ID = process.env.PLAYER_LOG_CHANNEL || '';
let MONITORING_ENABLED = false;
let playerTracker = {};  // Store player join times and durations
let monitoringInterval = null;

// File to persist player data
const PLAYER_DATA_FILE = './player_tracking_data.json';

// Load existing player data on startup
function loadPlayerData() {
    try {
        if (fs.existsSync(PLAYER_DATA_FILE)) {
            const data = fs.readFileSync(PLAYER_DATA_FILE, 'utf8');
            playerTracker = JSON.parse(data);
            console.log(`📁 Loaded tracking data for ${Object.keys(playerTracker).length} players`);
        }
    } catch (error) {
        console.error('Error loading player data:', error);
        playerTracker = {};
    }
}

// Save player data to file
function savePlayerData() {
    try {
        fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(playerTracker, null, 2));
    } catch (error) {
        console.error('Error saving player data:', error);
    }
}

// Format duration in a readable way
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Generic player extraction function for any server
async function extractPlayersFromServer(serverKey = 'royalty') {
    const server = SERVERS[serverKey];
    if (!server) {
        throw new Error(`Unknown server: ${serverKey}`);
    }
    
    console.log(`🎯 Starting player extraction for ${server.name} (${server.id})...`);
    
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Monitor API calls for player data
        await page.setRequestInterception(true);
        let playerApiData = null;
        
        page.on('request', (request) => {
            request.continue();
        });
        
        page.on('response', async (response) => {
            if (response.url().includes('api/servers/single/') && response.url().includes(server.id)) {
                try {
                    playerApiData = await response.json();
                } catch (e) {
                    console.log('❌ Could not parse API response');
                }
            }
        });
        
        await page.goto(server.url, { 
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
        }
        
        return {
            players: currentPlayers,
            serverInfo: {
                clients: playerApiData?.Data?.clients || 0,
                maxClients: playerApiData?.Data?.sv_maxclients || 0,
                hostname: playerApiData?.Data?.hostname || server.name,
                serverName: server.name,
                serverId: server.id
            }
        };
        
    } catch (error) {
        console.log(`❌ Extraction failed for ${server.name}: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message, serverInfo: { serverName: server.name, serverId: server.id } };
    }
}

// Enhanced player extraction with tracking (for Royalty RP only)
async function extractAndTrackPlayers() {
    console.log('🎯 Starting player extraction with tracking...');
    
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Monitor API calls for player data
        await page.setRequestInterception(true);
        let playerApiData = null;
        
        page.on('request', (request) => {
            request.continue();
        });
        
        page.on('response', async (response) => {
            if (response.url().includes('api/servers/single/') && response.url().includes(SERVER_ID)) {
                try {
                    playerApiData = await response.json();
                } catch (e) {
                    console.log('❌ Could not parse API response');
                }
            }
        });
        
        await page.goto(SERVER_URL, { 
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
        }
        
        // Update player tracking
        const currentTime = Date.now();
        const previousPlayers = Object.keys(playerTracker);
        
        // Add new players
        currentPlayers.forEach(player => {
            if (!playerTracker[player]) {
                playerTracker[player] = {
                    joinTime: currentTime,
                    totalTime: 0,
                    sessionCount: 1,
                    lastSeen: currentTime,
                    isOnline: true
                };
                console.log(`✅ New player joined: ${player}`);
                
                // Log to Discord if channel is set
                if (LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'joined');
                }
            } else if (!playerTracker[player].isOnline) {
                // Player rejoined after being offline
                playerTracker[player].joinTime = currentTime;
                playerTracker[player].sessionCount += 1;
                playerTracker[player].lastSeen = currentTime;
                playerTracker[player].isOnline = true;
                
                console.log(`🔄 Player rejoined: ${player}`);
                
                // Log to Discord if channel is set
                if (LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'joined');
                }
            } else {
                // Player is still online, update last seen
                playerTracker[player].lastSeen = currentTime;
                playerTracker[player].isOnline = true;
            }
        });
        
        // Check for players who left
        previousPlayers.forEach(player => {
            if (playerTracker[player].isOnline && !currentPlayers.includes(player)) {
                // Player left
                const sessionDuration = currentTime - playerTracker[player].joinTime;
                playerTracker[player].totalTime += sessionDuration;
                playerTracker[player].isOnline = false;
                
                console.log(`❌ Player left: ${player} (Session: ${formatDuration(sessionDuration)})`);
                
                // Log to Discord if channel is set
                if (LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'left', sessionDuration);
                }
            }
        });
        
        // Save data
        savePlayerData();
        
        return {
            players: currentPlayers,
            serverInfo: {
                clients: playerApiData?.Data?.clients || 0,
                maxClients: playerApiData?.Data?.sv_maxclients || 0,
                hostname: playerApiData?.Data?.hostname || 'Unknown'
            },
            tracking: playerTracker
        };
        
    } catch (error) {
        console.log(`❌ Extraction failed: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message };
    }
}

// Log player activity to Discord
async function logPlayerActivity(playerName, action, duration = null) {
    if (!LOG_CHANNEL_ID) return;
    
    try {
        const channel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Cannot find log channel with ID: ${LOG_CHANNEL_ID}`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTimestamp();
        
        if (action === 'joined') {
            embed.setColor('#00ff00')
                .setTitle('🟢 Player Joined')
                .setDescription(`**${playerName}** joined the server`)
                .addFields({ name: 'Time', value: new Date().toLocaleString(), inline: true });
        } else if (action === 'left') {
            embed.setColor('#ff0000')
                .setTitle('🔴 Player Left')
                .setDescription(`**${playerName}** left the server`)
                .addFields(
                    { name: 'Session Duration', value: formatDuration(duration), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        }
        
        await channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error logging to Discord:', error);
    }
}

// Start monitoring players
function startMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    MONITORING_ENABLED = true;
    console.log('🔄 Started player monitoring (5-minute intervals)');
    
    // Monitor every 5 minutes
    monitoringInterval = setInterval(async () => {
        if (MONITORING_ENABLED) {
            try {
                await extractAndTrackPlayers();
            } catch (error) {
                console.error('Error during monitoring:', error);
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Stop monitoring players
function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    MONITORING_ENABLED = false;
    console.log('⏹️ Stopped player monitoring');
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎯 Enhanced player tracker ready for server: ${SERVER_ID}`);
    
    // Load existing player data
    loadPlayerData();
    
    if (LOG_CHANNEL_ID) {
        console.log(`📊 Log channel configured: ${LOG_CHANNEL_ID}`);
    } else {
        console.log('⚠️ No log channel configured. Use !setchannel to set one.');
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    const args = message.content.split(' ');
    
    // Set log channel command
    if (content.startsWith('!setchannel')) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ You need Administrator permissions to set the log channel.');
        }
        
        const channelId = args[1] || message.channel.id;
        LOG_CHANNEL_ID = channelId;
        
        // Update .env file
        const envContent = fs.readFileSync('.env', 'utf8');
        const newEnvContent = envContent.includes('PLAYER_LOG_CHANNEL=') 
            ? envContent.replace(/PLAYER_LOG_CHANNEL=.*/, `PLAYER_LOG_CHANNEL=${channelId}`)
            : envContent + `\nPLAYER_LOG_CHANNEL=${channelId}`;
        
        fs.writeFileSync('.env', newEnvContent);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Log Channel Set')
            .setDescription(`Player activity will now be logged to <#${channelId}>`)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
        console.log(`📊 Log channel set to: ${channelId}`);
        return;
    }
    
    // Start monitoring command
    if (content === '!startmonitor') {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ You need Administrator permissions to start monitoring.');
        }
        
        startMonitoring();
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔄 Monitoring Started')
            .setDescription('Player tracking has been started. Players will be monitored every 5 minutes.')
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
        return;
    }
    
    // Stop monitoring command
    if (content === '!stopmonitor') {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ You need Administrator permissions to stop monitoring.');
        }
        
        stopMonitoring();
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('⏹️ Monitoring Stopped')
            .setDescription('Player tracking has been stopped.')
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
        return;
    }
    
    // Show player durations
    if (content === '!durations' || content === '!times') {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('⏱️ Player Session Times')
            .setTimestamp();
        
        const onlinePlayers = Object.entries(playerTracker)
            .filter(([player, data]) => data.isOnline)
            .map(([player, data]) => {
                const currentSession = Date.now() - data.joinTime;
                return `**${player}**: ${formatDuration(currentSession)} (current session)`;
            });
        
        if (onlinePlayers.length === 0) {
            embed.setDescription('No players currently being tracked.');
        } else {
            embed.setDescription(onlinePlayers.join('\n'));
        }
        
        message.reply({ embeds: [embed] });
        return;
    }
    
    // Regular player list commands
    if (content === '!players' || content === '!names' || content === '!list') {
        const loadingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🎯 Extracting Player Names...')
            .setDescription('Getting current player list and updating tracking data...\n\n*This may take 30-60 seconds*')
            .setTimestamp();
        
        const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            const results = await extractAndTrackPlayers();
            
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
                    .setDescription('Server appears to be empty or inaccessible.')
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [noPlayersEmbed] });
            }
            
            // Success - display found players with tracking info
            const cleanHostname = results.serverInfo.hostname.replace(/\^\d/g, '').replace(/\|.*$/, '').trim();
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 Online Players')
                .setDescription(`**${cleanHostname}**`)
                .setTimestamp();
            
            // Add player counter
            embed.addFields({
                name: '👥 Players Online',
                value: `**${results.players.length}** out of **${results.serverInfo.maxClients}** slots`,
                inline: false
            });
            
            // Create player list with session times
            const playerListWithTimes = results.players.map(player => {
                const trackingData = playerTracker[player];
                if (trackingData && trackingData.isOnline) {
                    const currentSession = Date.now() - trackingData.joinTime;
                    return `${player} (${formatDuration(currentSession)})`;
                }
                return player;
            });
            
            const playerList = playerListWithTimes.join('\n');
            
            // Handle Discord's character limit
            if (playerList.length <= 1024) {
                embed.addFields({
                    name: '📋 Complete Player List (with session times)',
                    value: playerList,
                    inline: false
                });
            } else {
                // Split into chunks if too long
                const chunkSize = 900;
                let currentChunk = '';
                let chunkNumber = 1;
                
                playerListWithTimes.forEach(player => {
                    const playerLine = player + '\n';
                    
                    if (currentChunk.length + playerLine.length > chunkSize) {
                        embed.addFields({
                            name: chunkNumber === 1 ? '📋 Player List (with times)' : '📋 Player List (continued)',
                            value: currentChunk.trim(),
                            inline: false
                        });
                        currentChunk = playerLine;
                        chunkNumber++;
                    } else {
                        currentChunk += playerLine;
                    }
                });
                
                if (currentChunk.trim()) {
                    embed.addFields({
                        name: chunkNumber === 1 ? '📋 Player List (with times)' : '📋 Player List (continued)',
                        value: currentChunk.trim(),
                        inline: false
                    });
                }
            }
            
            // Add monitoring status
            embed.addFields({
                name: '📊 Tracking Status',
                value: MONITORING_ENABLED ? '🟢 Monitoring Active' : '🔴 Monitoring Inactive',
                inline: true
            });
            
            embed.setFooter({ text: `Server ID: ${SERVER_ID} | Enhanced Tracking` });
            
            loadingMessage.edit({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error during extraction:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred during extraction.')
                .addFields({ name: 'Error Details', value: error.message })
                .setTimestamp();
            
            loadingMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    // Horizon server player list command
    if (content === '!horizon') {
        const loadingEmbed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🌅 Extracting Horizon Player Names...')
            .setDescription('Getting current player list from Horizon server...\n\n*This may take 30-60 seconds*')
            .setTimestamp();
        
        const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
        
        try {
            const results = await extractPlayersFromServer('horizon');
            
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
                    .setDescription('Horizon server appears to be empty or inaccessible.')
                    .setTimestamp();
                
                return loadingMessage.edit({ embeds: [noPlayersEmbed] });
            }
            
            // Success - display found players
            const cleanHostname = results.serverInfo.hostname.replace(/\^\d/g, '').replace(/\|.*$/, '').trim();
            
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('🌅 Horizon Online Players')
                .setDescription(`**${cleanHostname}**`)
                .setTimestamp();
            
            // Add player counter
            embed.addFields({
                name: '👥 Players Online',
                value: `**${results.players.length}** out of **${results.serverInfo.maxClients}** slots`,
                inline: false
            });
            
            // Create player list (no session times for Horizon as it's not tracked)
            const playerList = results.players.join('\n');
            
            // Handle Discord's character limit
            if (playerList.length <= 1024) {
                embed.addFields({
                    name: '📋 Complete Player List',
                    value: playerList,
                    inline: false
                });
            } else {
                // Split into chunks if too long
                const chunkSize = 900;
                let currentChunk = '';
                let chunkNumber = 1;
                
                results.players.forEach(player => {
                    const playerLine = player + '\n';
                    
                    if (currentChunk.length + playerLine.length > chunkSize) {
                        embed.addFields({
                            name: chunkNumber === 1 ? '📋 Player List' : '📋 Player List (continued)',
                            value: currentChunk.trim(),
                            inline: false
                        });
                        currentChunk = playerLine;
                        chunkNumber++;
                    } else {
                        currentChunk += playerLine;
                    }
                });
                
                if (currentChunk.trim()) {
                    embed.addFields({
                        name: chunkNumber === 1 ? '📋 Player List' : '📋 Player List (continued)',
                        value: currentChunk.trim(),
                        inline: false
                    });
                }
            }
            
            embed.setFooter({ text: `Server ID: ${results.serverInfo.serverId} | Horizon Server` });
            
            loadingMessage.edit({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error during Horizon extraction:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred during extraction.')
                .addFields({ name: 'Error Details', value: error.message })
                .setTimestamp();
            
            loadingMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    if (content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎯 Enhanced FiveM Player Tracker')
            .setDescription('Track player names and session durations with logging')
            .addFields(
                { name: '👥 Player Commands', value: '`!players` - Show Royalty RP players with session times\n`!horizon` - Show Horizon server players\n`!durations` - Show current session durations\n`!names` / `!list` - Same as !players', inline: false },
                { name: '⚙️ Admin Commands', value: '`!setchannel [ID]` - Set logging channel\n`!startmonitor` - Start automatic monitoring\n`!stopmonitor` - Stop automatic monitoring', inline: false },
                { name: '📊 Features', value: '• Real-time player tracking\n• Session duration logging\n• Join/leave notifications\n• Persistent data storage\n• 5-minute monitoring intervals', inline: false }
            )
            .setFooter({ text: 'Enhanced Player Tracker v4.0' })
            .setTimestamp();
        
        message.reply({ embeds: [helpEmbed] });
    }
});

client.on('error', console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down bot...');
    savePlayerData();
    stopMonitoring();
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
