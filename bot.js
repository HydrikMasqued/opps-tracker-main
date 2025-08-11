// Container deployment timestamp: 2025-08-10 17:30 UTC
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

// Auto Chrome installer
const { autoInstallChrome } = require('./auto-chrome-installer');

// Run Chrome installer on startup
(async () => {
    console.log('🔧 Running auto Chrome installer...');
    await autoInstallChrome();
    console.log('🎯 Chrome installer completed - starting bot...');
})();

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

// Chrome-free API fallback
async function extractPlayersViaAPI(serverId) {
    console.log(`🌐 Using API fallback for server: ${serverId}`);
    
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
                .filter(name => name && typeof name === 'string')
                .filter(name => {
                    const uiElements = [
                        'github', 'forum', 'docs', 'portal', 'terms', 'privacy', 'support',
                        'connect', 'server', 'admin', 'owner', 'staff', 'moderator',
                        'website', 'discord', 'support', 'help', 'about', 'contact'
                    ];
                    return !uiElements.some(element => name.toLowerCase().includes(element));
                });
            
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

// Generic player extraction function for any server
async function extractPlayersFromServer(serverKey = 'royalty') {
    const server = SERVERS[serverKey];
    if (!server) {
        throw new Error(`Unknown server: ${serverKey}`);
    }
    
    console.log(`🎯 Starting player extraction for ${server.name} (${server.id})...`);
    
    // Try API first (Chrome-free method)
    try {
        const apiResult = await extractPlayersViaAPI(server.id);
        console.log(`✅ API extraction successful: ${apiResult.players.length} players`);
        return {
            players: apiResult.players,
            serverInfo: {
                ...apiResult.serverInfo,
                serverName: server.name,
                serverId: server.id
            }
        };
    } catch (apiError) {
        console.log(`⚠️ API method failed (${apiError.message}), trying Puppeteer...`);
    }
    
    // Fallback to Puppeteer if API fails
    let browser;
    try {
        // Windows/Linux compatible Puppeteer configuration
        const os = require('os');
        const launchOptions = {
            headless: 'new',
            args: os.platform() === 'win32' 
                ? [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
                : [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--single-process'
                ]
        };
        
        // Try to find Chrome executable (Windows/Linux compatible)
        let chromeFound = false;
        
        // First check environment variables
        if (process.env.CHROME_BIN) {
            launchOptions.executablePath = process.env.CHROME_BIN;
            console.log(`🔍 Using Chrome from CHROME_BIN: ${process.env.CHROME_BIN}`);
            chromeFound = true;
        } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log(`🔍 Using Chrome from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
            chromeFound = true;
        } else {
            // Platform-specific Chrome paths
            const os = require('os');
            const path = require('path');
            
            let chromePaths = [];
            
            if (os.platform() === 'win32') {
                // Windows paths (including Puppeteer's downloaded Chrome)
                const puppeteerCachePath = path.join(__dirname, '.cache', 'puppeteer');
                chromePaths = [
                    path.join(puppeteerCachePath, 'chrome', 'win64-121.0.6167.85', 'chrome-win64', 'chrome.exe'),
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
                ];
            } else {
                // Linux paths (container/cloud deployment)
                const isContainer = process.env.NODE_ENV === 'production' || process.env.CONTAINER_ENV || process.cwd().includes('/home/container');
                const containerCachePath = '/home/container/.cache/puppeteer';
                
                chromePaths = [];
                
                // Container-specific Puppeteer Chrome paths
                if (isContainer) {
                    // Check for various Chrome versions in container cache
                    const chromeCacheDir = path.join(containerCachePath, 'chrome');
                    try {
                        if (fs.existsSync(chromeCacheDir)) {
                            const chromeVersions = fs.readdirSync(chromeCacheDir);
                            for (const version of chromeVersions) {
                                if (version.startsWith('linux-')) {
                                    chromePaths.push(path.join(chromeCacheDir, version, 'chrome-linux64', 'chrome'));
                                }
                            }
                        }
                    } catch (e) {
                        console.log('⚠️ Could not scan Chrome cache directory');
                    }
                }
                
                // Add standard Linux Chrome paths
                chromePaths.push(
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    '/snap/bin/chromium',
                    '/usr/local/bin/chromium',
                    '/opt/google/chrome/chrome'
                );
            }
            
            for (const chromePath of chromePaths) {
                try {
                    require('fs').accessSync(chromePath, require('fs').constants.F_OK);
                    launchOptions.executablePath = chromePath;
                    console.log(`✅ Found Chrome at: ${chromePath}`);
                    chromeFound = true;
                    break;
                } catch (e) {
                    // Continue searching
                }
            }
        }
        
        if (!chromeFound) {
            const platform = require('os').platform();
            if (platform === 'win32') {
                // On Windows, let Puppeteer use its bundled Chrome if available
                console.log('⚠️ Chrome not found in specific paths, letting Puppeteer use bundled Chrome...');
                // Don't set executablePath, let Puppeteer find it
            } else {
                // On Linux, we need Chrome to be explicitly available
                console.log(`❌ No Chrome executable found on ${platform}`);
                console.log(`🔄 Checked paths: ${chromePaths?.join(', ') || 'standard paths'}`);
                throw new Error('Chrome not found - please install Chromium or set PUPPETEER_EXECUTABLE_PATH');
            }
        }
        
        browser = await puppeteer.launch(launchOptions);
        
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
    
    // Try API first (Chrome-free method)
    let currentPlayers = [];
    let serverInfo = { clients: 0, maxClients: 0, hostname: 'Unknown' };
    
    try {
        const apiResult = await extractPlayersViaAPI(SERVER_ID);
        currentPlayers = apiResult.players;
        serverInfo = apiResult.serverInfo;
        console.log(`✅ API extraction successful for tracking: ${currentPlayers.length} players`);
    } catch (apiError) {
        console.log(`⚠️ API method failed for tracking (${apiError.message}), trying Puppeteer...`);
        
        // Fallback to Puppeteer if API fails
        let browser;
        try {
            // Container-optimized Puppeteer configuration
            const launchOptions = {
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
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--single-process'
                ]
            };
            
            // Try to find Chrome executable in container
            if (process.env.CHROME_BIN) {
                launchOptions.executablePath = process.env.CHROME_BIN;
            } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            } else {
                // Common Chrome paths in containers
                const chromePaths = [
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    '/snap/bin/chromium'
                ];
                
                for (const path of chromePaths) {
                    try {
                        require('fs').accessSync(path, require('fs').constants.F_OK);
                        launchOptions.executablePath = path;
                        console.log(`✅ Found Chrome at: ${path}`);
                        break;
                    } catch (e) {
                        // Continue searching
                    }
                }
            }
            
            browser = await puppeteer.launch(launchOptions);
            
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
                
                serverInfo = {
                    clients: playerApiData?.Data?.clients || 0,
                    maxClients: playerApiData?.Data?.sv_maxclients || 0,
                    hostname: playerApiData?.Data?.hostname || 'Unknown'
                };
            }
            
        } catch (error) {
            console.log(`❌ Puppeteer extraction failed: ${error.message}`);
            if (browser) await browser.close();
            return { players: [], error: error.message };
        }
    }
    
    try {
        
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
            serverInfo: serverInfo,
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
