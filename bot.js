// Container deployment timestamp: 2025-08-10 17:30 UTC
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

// Chrome installer for cloud deployment
const { installChrome } = require('./install-chrome');

// Run Chrome installer BEFORE starting bot
(async () => {
    console.log('🚀 Running Chrome installer for cloud deployment...');
    console.log('Cache path will be: /home/container/.cache/puppeteer (if container)');
    
    try {
        await installChrome();
        console.log('✅ Chrome installer completed - starting bot...');
    } catch (error) {
        console.log('⚠️ Chrome installation had issues, but bot will still try to run...');
        console.log('Error:', error.message);
    }
    
    // Start the bot after Chrome setup
    startBot();
})();

function startBot() {

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

// Advanced tracking system files
const TRACKED_PLAYERS_FILE = './tracked_players.json';
const TRACKING_NOTIFICATIONS_FILE = './tracking_notifications.json';

// Tracking categories
const TRACKING_CATEGORIES = {
    poi: {
        name: 'People of Interest',
        emoji: '📍',
        color: '#FFD700',
        description: 'Players being monitored for activity'
    },
    club: {
        name: 'Club Members & Associates',
        emoji: '🏢', 
        color: '#00FF00',
        description: 'Friendly players and allies'
    },
    enemies: {
        name: 'Enemies',
        emoji: '⚔️',
        color: '#FF0000', 
        description: 'Hostile players to watch carefully'
    }
};

// Tracked players storage
let trackedPlayers = {};
let trackingNotifications = {};
let horizonPlayerTracker = {};  // Separate tracking for Horizon server

// Player database for name history
let playerDatabase = {};
const PLAYER_DATABASE_FILE = './player_database.json';

// Load player database
function loadPlayerDatabase() {
    try {
        if (fs.existsSync(PLAYER_DATABASE_FILE)) {
            const data = fs.readFileSync(PLAYER_DATABASE_FILE, 'utf8');
            playerDatabase = JSON.parse(data);
            console.log(`🗃️ Loaded player database with ${Object.keys(playerDatabase).length} unique players`);
        }
    } catch (error) {
        console.error('Error loading player database:', error);
        playerDatabase = {};
    }
}

// Save player database
function savePlayerDatabase() {
    try {
        fs.writeFileSync(PLAYER_DATABASE_FILE, JSON.stringify(playerDatabase, null, 2));
    } catch (error) {
        console.error('Error saving player database:', error);
    }
}

// Add players to database
function addPlayersToDatabase(players, serverKey) {
    const currentTime = Date.now();
    players.forEach(playerName => {
        const playerId = playerName.toLowerCase().trim();
        if (!playerDatabase[playerId]) {
            playerDatabase[playerId] = {
                name: playerName,
                firstSeen: currentTime,
                lastSeen: currentTime,
                servers: [serverKey],
                totalSightings: 1
            };
        } else {
            // Update existing entry
            playerDatabase[playerId].lastSeen = currentTime;
            playerDatabase[playerId].totalSightings++;
            if (!playerDatabase[playerId].servers.includes(serverKey)) {
                playerDatabase[playerId].servers.push(serverKey);
            }
        }
    });
    savePlayerDatabase();
}

// Search player database
function searchPlayerDatabase(searchTerm) {
    const search = searchTerm.toLowerCase().trim();
    const matches = [];
    
    for (const [playerId, data] of Object.entries(playerDatabase)) {
        if (data.name.toLowerCase().includes(search)) {
            matches.push({
                id: playerId,
                ...data,
                relevance: data.name.toLowerCase().indexOf(search) === 0 ? 2 : 1 // Exact start match gets higher relevance
            });
        }
    }
    
    // Sort by relevance then by total sightings
    return matches.sort((a, b) => {
        if (a.relevance !== b.relevance) return b.relevance - a.relevance;
        return b.totalSightings - a.totalSightings;
    }).slice(0, 10); // Return top 10 matches
}

// Load existing player data on startup (both servers)
function loadPlayerData() {
    try {
        // Load Royalty RP data
        if (fs.existsSync(PLAYER_DATA_FILE)) {
            const data = fs.readFileSync(PLAYER_DATA_FILE, 'utf8');
            playerTracker = JSON.parse(data);
            console.log(`📁 Loaded Royalty RP tracking data for ${Object.keys(playerTracker).length} players`);
        }
        
        // Load Horizon data
        const HORIZON_DATA_FILE = './horizon_tracking_data.json';
        if (fs.existsSync(HORIZON_DATA_FILE)) {
            const horizonData = fs.readFileSync(HORIZON_DATA_FILE, 'utf8');
            horizonPlayerTracker = JSON.parse(horizonData);
            console.log(`📁 Loaded Horizon tracking data for ${Object.keys(horizonPlayerTracker).length} players`);
        }
    } catch (error) {
        console.error('Error loading player data:', error);
        playerTracker = {};
        horizonPlayerTracker = {};
    }
}

// Load tracked players data
function loadTrackedPlayers() {
    try {
        if (fs.existsSync(TRACKED_PLAYERS_FILE)) {
            const data = fs.readFileSync(TRACKED_PLAYERS_FILE, 'utf8');
            trackedPlayers = JSON.parse(data);
            console.log(`📍 Loaded ${Object.keys(trackedPlayers).length} tracked players`);
        }
    } catch (error) {
        console.error('Error loading tracked players:', error);
        trackedPlayers = {};
    }
}

// Save tracked players data
function saveTrackedPlayers() {
    try {
        fs.writeFileSync(TRACKED_PLAYERS_FILE, JSON.stringify(trackedPlayers, null, 2));
    } catch (error) {
        console.error('Error saving tracked players:', error);
    }
}

// Load tracking notifications data
function loadTrackingNotifications() {
    try {
        if (fs.existsSync(TRACKING_NOTIFICATIONS_FILE)) {
            const data = fs.readFileSync(TRACKING_NOTIFICATIONS_FILE, 'utf8');
            trackingNotifications = JSON.parse(data);
            console.log(`🔔 Loaded tracking notifications`);
        }
    } catch (error) {
        console.error('Error loading tracking notifications:', error);
        trackingNotifications = {};
    }
}

// Save tracking notifications data
function saveTrackingNotifications() {
    try {
        fs.writeFileSync(TRACKING_NOTIFICATIONS_FILE, JSON.stringify(trackingNotifications, null, 2));
    } catch (error) {
        console.error('Error saving tracking notifications:', error);
    }
}

// Add a player to tracking
function addTrackedPlayer(playerName, category, addedBy, reason = '') {
    const cleanName = playerName.trim();
    const trackingId = cleanName.toLowerCase();
    
    trackedPlayers[trackingId] = {
        name: cleanName,
        category: category,
        addedBy: addedBy,
        addedAt: Date.now(),
        reason: reason,
        notifications: {
            joinAlerts: true,
            leaveAlerts: true,
            sessionUpdates: true
        },
        servers: ['royalty', 'horizon'], // Track on both servers by default
        lastSeen: {
            royalty: null,
            horizon: null
        },
        sessionData: {
            royalty: { isOnline: false, joinTime: null, totalTime: 0, sessionCount: 0 },
            horizon: { isOnline: false, joinTime: null, totalTime: 0, sessionCount: 0 }
        }
    };
    
    saveTrackedPlayers();
    return trackedPlayers[trackingId];
}

// Remove a player from tracking
function removeTrackedPlayer(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    if (trackedPlayers[trackingId]) {
        delete trackedPlayers[trackingId];
        saveTrackedPlayers();
        return true;
    }
    return false;
}

// Check if a player is being tracked
function isPlayerTracked(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    return trackedPlayers[trackingId] || null;
}

// Get tracked players by category
function getTrackedPlayersByCategory(category) {
    return Object.values(trackedPlayers).filter(player => player.category === category);
}

// Send enhanced tracking notification with ping
async function sendTrackedPlayerNotification(playerData, action, serverKey, sessionDuration = null) {
    if (!LOG_CHANNEL_ID) return;
    
    try {
        const channel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!channel) return;
        
        const category = TRACKING_CATEGORIES[playerData.category];
        const serverName = SERVERS[serverKey]?.name || serverKey;
        
        // Get total time for this player
        const tracker = serverKey === 'royalty' ? playerTracker : horizonPlayerTracker;
        const totalTime = tracker[playerData.name]?.totalTime || 0;
        
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setColor(category.color);
        
        if (action === 'joined') {
            embed.setTitle(`${category.emoji} ${category.name} - Player Joined`)
                .setDescription(`**${playerData.name}** joined **${serverName}**`)
                .addFields(
                    { name: 'Category', value: category.name, inline: true },
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Total Time', value: formatDuration(totalTime), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
                
            if (playerData.reason) {
                embed.addFields({ name: 'Tracking Reason', value: playerData.reason, inline: false });
            }
        } else if (action === 'left') {
            const newTotalTime = totalTime + (sessionDuration || 0);
            embed.setTitle(`${category.emoji} ${category.name} - Player Left`)
                .setDescription(`**${playerData.name}** left **${serverName}**`)
                .addFields(
                    { name: 'Category', value: category.name, inline: true },
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Session Duration', value: formatDuration(sessionDuration), inline: true },
                    { name: 'Total Time', value: formatDuration(newTotalTime), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        }
        
        // Enhanced ping system for all tracked players
        let messageContent = '@here ';
        if (playerData.category === 'enemies') {
            messageContent = '@here 🚨 **ENEMY ALERT** 🚨';
        } else if (playerData.category === 'poi') {
            messageContent = '@here 📍 **PERSON OF INTEREST ACTIVITY**';
        } else if (playerData.category === 'club') {
            messageContent = '@here 🏢 **CLUB MEMBER ACTIVITY**';
        }
        
        await channel.send({ 
            content: messageContent,
            embeds: [embed] 
        });
        
    } catch (error) {
        console.error('Error sending tracked player notification:', error);
    }
}

// Send tracking notification (legacy - keeping for compatibility)
async function sendTrackingNotification(playerData, action, serverKey, sessionDuration = null) {
    return await sendTrackedPlayerNotification(playerData, action, serverKey, sessionDuration);
}

// Save player data to file (both servers)
function savePlayerData() {
    try {
        // Save Royalty RP data
        fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(playerTracker, null, 2));
        
        // Save Horizon data
        const HORIZON_DATA_FILE = './horizon_tracking_data.json';
        fs.writeFileSync(HORIZON_DATA_FILE, JSON.stringify(horizonPlayerTracker, null, 2));
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
            console.log(`⚠️ Chrome not found in specific paths on ${platform}`);
            console.log('🔄 Letting Puppeteer use its configured/bundled Chrome...');
            // Don't set executablePath, let Puppeteer find it via configuration
            // This works for both local (bundled) and cloud (downloaded via .puppeteerrc.cjs)
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
        
        // Always save extracted players to database before returning
        if (currentPlayers && currentPlayers.length > 0) {
            addPlayersToDatabase(currentPlayers, serverKey);
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
            // Use the same working configuration as debug script
            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
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
        
        // Add players to database
        if (currentPlayers.length > 0) {
            addPlayersToDatabase(currentPlayers, 'royalty');
        }
        
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

// Log player activity to Discord with server information
async function logPlayerActivity(playerName, action, duration = null, serverKey = 'royalty') {
    if (!LOG_CHANNEL_ID) return;
    
    try {
        const channel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Cannot find log channel with ID: ${LOG_CHANNEL_ID}`);
            return;
        }
        
        const serverName = SERVERS[serverKey]?.name || serverKey;
        const embed = new EmbedBuilder()
            .setTimestamp();
        
        if (action === 'joined') {
            embed.setColor('#00ff00')
                .setTitle('🟢 Player Joined')
                .setDescription(`**${playerName}** joined **${serverName}**`)
                .addFields(
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        } else if (action === 'left') {
            embed.setColor('#ff0000')
                .setTitle('🔴 Player Left')
                .setDescription(`**${playerName}** left **${serverName}**`)
                .addFields(
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Session Duration', value: formatDuration(duration), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        }
        
        await channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error logging to Discord:', error);
    }
}

// Enhanced monitoring for both servers
async function monitorBothServers() {
    if (!MONITORING_ENABLED) return;
    
    try {
        // Monitor both servers simultaneously
        const [royaltyResults, horizonResults] = await Promise.all([
            extractPlayersFromServer('royalty'),
            extractPlayersFromServer('horizon')
        ]);
        
        // Process Royalty RP server
        if (royaltyResults.players && royaltyResults.players.length > 0) {
            await processServerPlayerChanges('royalty', royaltyResults.players, playerTracker);
            addPlayersToDatabase(royaltyResults.players, 'royalty');
        }
        
        // Process Horizon server
        if (horizonResults.players && horizonResults.players.length > 0) {
            await processServerPlayerChanges('horizon', horizonResults.players, horizonPlayerTracker);
            addPlayersToDatabase(horizonResults.players, 'horizon');
        }
        
        // Save all tracking data
        savePlayerData();
        
    } catch (error) {
        console.error('Error during dual-server monitoring:', error);
    }
}

// Process player changes for a specific server
async function processServerPlayerChanges(serverKey, currentPlayers, tracker) {
    const currentTime = Date.now();
    const previousPlayers = Object.keys(tracker);
    const serverName = SERVERS[serverKey]?.name || serverKey;
    
    // Add new players or update rejoining players
    currentPlayers.forEach(player => {
        if (!tracker[player]) {
            tracker[player] = {
                joinTime: currentTime,
                totalTime: 0,
                sessionCount: 1,
                lastSeen: currentTime,
                isOnline: true
            };
            console.log(`✅ [${serverName}] New player joined: ${player}`);
            
            // Check if player is tracked and send notification with ping
            const trackedPlayer = isPlayerTracked(player);
            if (trackedPlayer && LOG_CHANNEL_ID) {
                await sendTrackedPlayerNotification(trackedPlayer, 'joined', serverKey);
            } else if (LOG_CHANNEL_ID) {
                logPlayerActivity(player, 'joined', null, serverKey);
            }
        } else if (!tracker[player].isOnline) {
            // Player rejoined after being offline
            tracker[player].joinTime = currentTime;
            tracker[player].sessionCount += 1;
            tracker[player].lastSeen = currentTime;
            tracker[player].isOnline = true;
            
            console.log(`🔄 [${serverName}] Player rejoined: ${player} (Total time: ${formatDuration(tracker[player].totalTime)})`);
            
            // Check if player is tracked and send notification with ping
            const trackedPlayer = isPlayerTracked(player);
            if (trackedPlayer && LOG_CHANNEL_ID) {
                await sendTrackedPlayerNotification(trackedPlayer, 'joined', serverKey);
            } else if (LOG_CHANNEL_ID) {
                logPlayerActivity(player, 'joined', null, serverKey);
            }
        } else {
            // Player is still online, update last seen
            tracker[player].lastSeen = currentTime;
            tracker[player].isOnline = true;
        }
    });
    
    // Check for players who left
    previousPlayers.forEach(player => {
        if (tracker[player].isOnline && !currentPlayers.includes(player)) {
            // Player left - add session time to total
            const sessionDuration = currentTime - tracker[player].joinTime;
            tracker[player].totalTime += sessionDuration;
            tracker[player].isOnline = false;
            
            console.log(`❌ [${serverName}] Player left: ${player} (Session: ${formatDuration(sessionDuration)}, Total: ${formatDuration(tracker[player].totalTime)})`);
            
            // Check if player is tracked and send notification with ping
            const trackedPlayer = isPlayerTracked(player);
            if (trackedPlayer && LOG_CHANNEL_ID) {
                await sendTrackedPlayerNotification(trackedPlayer, 'left', serverKey, sessionDuration);
            } else if (LOG_CHANNEL_ID) {
                logPlayerActivity(player, 'left', sessionDuration, serverKey);
            }
        }
    });
}

// Start monitoring players
function startMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    MONITORING_ENABLED = true;
    console.log('🔄 Started enhanced monitoring for both servers (1-minute intervals)');
    
    // Monitor every 1 minute
    monitoringInterval = setInterval(async () => {
        if (MONITORING_ENABLED) {
            await monitorBothServers();
        }
    }, 1 * 60 * 1000); // 1 minute
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

// Slash command definitions
const commands = [
    new SlashCommandBuilder()
        .setName('track')
        .setDescription('Add a player to the tracking list')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name to track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Tracking category')
                .setRequired(true)
                .addChoices(
                    { name: '📍 People of Interest', value: 'poi' },
                    { name: '🏢 Club Members & Associates', value: 'club' },
                    { name: '⚔️ Enemies', value: 'enemies' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for tracking (optional)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('untrack')
        .setDescription('Remove a player from tracking')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name to untrack')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('tracked')
        .setDescription('View all tracked players with enhanced UI'),
    
    new SlashCommandBuilder()
        .setName('find')
        .setDescription('Search for a tracked player on servers')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name to find')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search player database history')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Partial player name to search for')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('royalty')
        .setDescription('Get current Royalty RP player list'),
    
    new SlashCommandBuilder()
        .setName('horizon')
        .setDescription('Get current Horizon server player list'),
    
    new SlashCommandBuilder()
        .setName('categories')
        .setDescription('View available tracking categories'),
    
    new SlashCommandBuilder()
        .setName('startmonitor')
        .setDescription('Start automatic player monitoring (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('stopmonitor')
        .setDescription('Stop automatic player monitoring (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Set the logging channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for logging (optional - uses current if not specified)')
                .setRequired(false))
].map(command => command.toJSON());

// Register slash commands
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        console.log('🔄 Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
}

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🎯 Enhanced player tracker ready for server: ${SERVER_ID}`);
    
    // Load existing player data
    loadPlayerData();
    loadTrackedPlayers();
    loadTrackingNotifications();
    loadPlayerDatabase();
    
    if (LOG_CHANNEL_ID) {
        console.log(`📊 Log channel configured: ${LOG_CHANNEL_ID}`);
    } else {
        console.log('⚠️ No log channel configured. Use !setchannel to set one.');
    }
    
    console.log(`📍 Loaded ${Object.keys(trackedPlayers).length} tracked players`);
    
    // Register slash commands
    await registerSlashCommands();
});

// Slash command interactions handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'track') {
            // Check admin permissions
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to manage tracked players.', ephemeral: true });
            }

            const playerName = interaction.options.getString('player');
            const category = interaction.options.getString('category');
            const reason = interaction.options.getString('reason') || '';

            const existingPlayer = isPlayerTracked(playerName);
            if (existingPlayer) {
                const categoryInfo = TRACKING_CATEGORIES[existingPlayer.category];
                return await interaction.reply({ content: `❌ **${playerName}** is already being tracked as ${categoryInfo.emoji} ${categoryInfo.name}`, ephemeral: true });
            }

            const trackedPlayer = addTrackedPlayer(playerName, category, interaction.user.tag, reason);
            const categoryInfo = TRACKING_CATEGORIES[category];

            const embed = new EmbedBuilder()
                .setColor(categoryInfo.color)
                .setTitle(`${categoryInfo.emoji} Player Added to Tracking`)
                .setDescription(`**${trackedPlayer.name}** is now being tracked`)
                .addFields(
                    { name: 'Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
                    { name: 'Added By', value: trackedPlayer.addedBy, inline: true },
                    { name: 'Servers', value: 'Royalty RP & Horizon', inline: true }
                );

            if (reason) {
                embed.addFields({ name: 'Reason', value: reason, inline: false });
            }

            console.log(`📍 Player tracked: ${trackedPlayer.name} (${category}) by ${interaction.user.tag}`);
            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'untrack') {
            // Check admin permissions
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to manage tracked players.', ephemeral: true });
            }

            const playerName = interaction.options.getString('player');
            const existingPlayer = isPlayerTracked(playerName);

            if (!existingPlayer) {
                return await interaction.reply({ content: `❌ **${playerName}** is not currently being tracked.`, ephemeral: true });
            }

            const categoryInfo = TRACKING_CATEGORIES[existingPlayer.category];
            const removed = removeTrackedPlayer(playerName);

            if (removed) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('🗑️ Player Removed from Tracking')
                    .setDescription(`**${existingPlayer.name}** is no longer being tracked`)
                    .addFields(
                        { name: 'Previous Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
                        { name: 'Removed By', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();

                console.log(`📍 Player untracked: ${existingPlayer.name} by ${interaction.user.tag}`);
                return await interaction.reply({ embeds: [embed] });
            } else {
                return await interaction.reply({ content: '❌ Failed to remove player from tracking.', ephemeral: true });
            }
        }

        else if (commandName === 'tracked') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📍 Tracked Players - Names List')
                .setDescription('Simple list of all tracked player names')
                .setTimestamp();

            const allPlayers = Object.values(trackedPlayers);
            if (allPlayers.length === 0) {
                embed.setDescription('No players are currently being tracked.\n\nUse `/track` to start tracking players.');
                return await interaction.reply({ embeds: [embed] });
            }

            // Group players by category and show just names
            const categories = ['enemies', 'poi', 'club']; // Enemies first for priority
            for (const categoryKey of categories) {
                const categoryPlayers = allPlayers.filter(p => p.category === categoryKey);
                if (categoryPlayers.length === 0) continue;

                const categoryInfo = TRACKING_CATEGORIES[categoryKey];
                const playerNames = categoryPlayers.map(player => player.name).join(', ');

                // Handle field length limits
                if (playerNames.length <= 1024) {
                    embed.addFields({
                        name: `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})`,
                        value: playerNames,
                        inline: false
                    });
                } else {
                    // Split long lists by names, not arbitrary character chunks
                    const names = categoryPlayers.map(player => player.name);
                    let currentChunk = '';
                    let chunkNumber = 1;

                    names.forEach((name, index) => {
                        const nameWithComma = index === names.length - 1 ? name : name + ', ';
                        if (currentChunk.length + nameWithComma.length > 900) {
                            embed.addFields({
                                name: chunkNumber === 1 ? `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})` : `${categoryInfo.name} (continued)`,
                                value: currentChunk.trim(),
                                inline: false
                            });
                            currentChunk = nameWithComma;
                            chunkNumber++;
                        } else {
                            currentChunk += nameWithComma;
                        }
                    });

                    if (currentChunk.trim()) {
                        embed.addFields({
                            name: chunkNumber === 1 ? `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})` : `${categoryInfo.name} (continued)`,
                            value: currentChunk.trim(),
                            inline: false
                        });
                    }
                }
            }

            embed.setFooter({ text: `Total: ${allPlayers.length} tracked players | Simple names view` });
            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'find') {
            const searchPlayer = interaction.options.getString('player');
            const trackedPlayer = isPlayerTracked(searchPlayer);

            if (!trackedPlayer) {
                return await interaction.reply({ content: `❌ **${searchPlayer}** is not in the tracking list.\nUse \`/track\` to start tracking them.`, ephemeral: true });
            }

            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🔍 Searching for Player...')
                .setDescription(`Looking for **${trackedPlayer.name}** on both servers...\n\n*This may take 30-60 seconds*`)
                .setTimestamp();

            await interaction.reply({ embeds: [loadingEmbed] });

            try {
                // Check both servers
                const [royaltyResults, horizonResults] = await Promise.all([
                    extractPlayersFromServer('royalty'),
                    extractPlayersFromServer('horizon')
                ]);

                const categoryInfo = TRACKING_CATEGORIES[trackedPlayer.category];
                const isOnRoyalty = royaltyResults.players?.some(p => p.toLowerCase() === trackedPlayer.name.toLowerCase());
                const isOnHorizon = horizonResults.players?.some(p => p.toLowerCase() === trackedPlayer.name.toLowerCase());

                const embed = new EmbedBuilder()
                    .setColor(categoryInfo.color)
                    .setTitle(`🔍 Search Results: ${trackedPlayer.name}`)
                    .setTimestamp();

                if (isOnRoyalty || isOnHorizon) {
                    const servers = [];
                    if (isOnRoyalty) servers.push('**Royalty RP**');
                    if (isOnHorizon) servers.push('**Horizon**');

                    embed.setDescription(`🟢 **PLAYER FOUND ONLINE**\n\n${categoryInfo.emoji} **${trackedPlayer.name}** is currently on: ${servers.join(' and ')}`);

                    if (trackedPlayer.category === 'enemies') {
                        embed.setDescription(`🚨 **ENEMY ALERT** 🚨\n\n⚔️ **${trackedPlayer.name}** is currently on: ${servers.join(' and ')}`);
                    }

                    // Add server details
                    if (isOnRoyalty && !royaltyResults.error) {
                        embed.addFields({
                            name: '🎭 Royalty RP',
                            value: `**Players:** ${royaltyResults.players?.length || 0}/${royaltyResults.serverInfo?.maxClients || 'Unknown'}\n**Status:** 🟢 Online`,
                            inline: true
                        });
                    }

                    if (isOnHorizon && !horizonResults.error) {
                        embed.addFields({
                            name: '🌅 Horizon',
                            value: `**Players:** ${horizonResults.players?.length || 0}/${horizonResults.serverInfo?.maxClients || 'Unknown'}\n**Status:** 🟢 Online`,
                            inline: true
                        });
                    }

                } else {
                    embed.setDescription(`🔴 **PLAYER NOT FOUND**\n\n${categoryInfo.emoji} **${trackedPlayer.name}** is not currently online on either server.`);
                    embed.setColor('#ff6b6b');
                }

                // Add tracking info in form style
                embed.addFields({
                    name: '📋 Tracking Information',
                    value: `**Category:** ${categoryInfo.emoji} ${categoryInfo.name}\n**Added:** ${new Date(trackedPlayer.addedAt).toLocaleDateString()}\n**Added by:** ${trackedPlayer.addedBy.split('#')[0]}`,
                    inline: false
                });

                if (trackedPlayer.reason) {
                    embed.addFields({
                        name: '📝 Tracking Reason',
                        value: trackedPlayer.reason,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error during find command:', error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Search Error')
                    .setDescription('An error occurred while searching for the player.')
                    .addFields({ name: 'Error Details', value: error.message })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        else if (commandName === 'search') {
            const searchTerm = interaction.options.getString('name');
            const matches = searchPlayerDatabase(searchTerm);

            if (matches.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('🔍 Player Database Search')
                    .setDescription(`No players found matching "**${searchTerm}**"\n\nTry a different search term or check spelling.`)
                    .addFields({ name: 'Database Size', value: `${Object.keys(playerDatabase).length} unique players recorded`, inline: true })
                    .setTimestamp();

                return await interaction.reply({ embeds: [noResultsEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`🔍 Player Database Search: "${searchTerm}"`)
                .setDescription(`Found **${matches.length}** player${matches.length !== 1 ? 's' : ''}:`)
                .setTimestamp();

            const playerList = matches.map(player => {
                const lastSeenDate = new Date(player.lastSeen).toLocaleDateString();
                const firstSeenDate = new Date(player.firstSeen).toLocaleDateString();
                const servers = player.servers.map(s => {
                    return s === 'royalty' ? 'Royalty RP' : s === 'horizon' ? 'Horizon' : s;
                }).join(', ');

                let resultText = `**${player.name}**\n`;
                resultText += `*Last seen:* ${lastSeenDate}\n`;
                resultText += `*First seen:* ${firstSeenDate}\n`;
                resultText += `*Total sightings:* ${player.totalSightings}\n`;
                resultText += `*Servers:* ${servers}`;

                // Check if player is currently tracked
                const trackedPlayer = isPlayerTracked(player.name);
                if (trackedPlayer) {
                    const categoryInfo = TRACKING_CATEGORIES[trackedPlayer.category];
                    resultText += `\n🎯 **Currently tracked as ${categoryInfo.emoji} ${categoryInfo.name}**`;
                }

                return resultText;
            }).join('\n\n');

            // Handle Discord's character limit for embeds
            if (playerList.length <= 1024) {
                embed.addFields({
                    name: '📋 Search Results',
                    value: playerList,
                    inline: false
                });
            } else {
                // Split into chunks if too long
                const chunks = [];
                let currentChunk = '';
                matches.forEach((player, index) => {
                    const playerText = playerList.split('\n\n')[index] + '\n\n';
                    if (currentChunk.length + playerText.length > 900) {
                        chunks.push(currentChunk.trim());
                        currentChunk = playerText;
                    } else {
                        currentChunk += playerText;
                    }
                });
                if (currentChunk.trim()) chunks.push(currentChunk.trim());

                chunks.forEach((chunk, index) => {
                    embed.addFields({
                        name: index === 0 ? '📋 Search Results' : '📋 Search Results (continued)',
                        value: chunk,
                        inline: false
                    });
                });
            }

            embed.setFooter({ text: `Database contains ${Object.keys(playerDatabase).length} unique players | Showing top ${matches.length} matches` });
            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'royalty') {
            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🎯 Extracting Player Names...')
                .setDescription('Getting current player list and updating tracking data...\n\n*This may take 30-60 seconds*')
                .setTimestamp();

            await interaction.reply({ embeds: [loadingEmbed] });

            try {
                const results = await extractAndTrackPlayers();

                if (results.error) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Extraction Error')
                        .setDescription('Error occurred during player name extraction.')
                        .addFields({ name: 'Error Details', value: results.error })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [errorEmbed] });
                }

                if (results.players.length === 0) {
                    const noPlayersEmbed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('⚠️ No Player Names Found')
                        .setDescription('Server appears to be empty or inaccessible.')
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [noPlayersEmbed] });
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

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error during extraction:', error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Unexpected Error')
                    .setDescription('An unexpected error occurred during extraction.')
                    .addFields({ name: 'Error Details', value: error.message })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        else if (commandName === 'horizon') {
            const loadingEmbed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('🌅 Extracting Horizon Player Names...')
                .setDescription('Getting current player list from Horizon server...\n\n*This may take 30-60 seconds*')
                .setTimestamp();

            await interaction.reply({ embeds: [loadingEmbed] });

            try {
                const results = await extractPlayersFromServer('horizon');

                if (results.error) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Extraction Error')
                        .setDescription('Error occurred during player name extraction.')
                        .addFields({ name: 'Error Details', value: results.error })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [errorEmbed] });
                }

                if (results.players.length === 0) {
                    const noPlayersEmbed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('⚠️ No Player Names Found')
                        .setDescription('Horizon server appears to be empty or inaccessible.')
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [noPlayersEmbed] });
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

                // Create player list with session times for Horizon
                const playerListWithTimes = results.players.map(player => {
                    const trackingData = horizonPlayerTracker[player];
                    if (trackingData && trackingData.isOnline) {
                        const currentSession = Date.now() - trackingData.joinTime;
                        const totalTime = trackingData.totalTime + currentSession;
                        return `${player} (Total: ${formatDuration(totalTime)}, Current: ${formatDuration(currentSession)})`;
                    } else if (trackingData) {
                        // Player is offline but has total time
                        return `${player} (Total: ${formatDuration(trackingData.totalTime)})`;
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

                embed.setFooter({ text: `Server ID: ${results.serverInfo.serverId} | Horizon Server` });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error during Horizon extraction:', error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Unexpected Error')
                    .setDescription('An unexpected error occurred during extraction.')
                    .addFields({ name: 'Error Details', value: error.message })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        else if (commandName === 'categories') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📂 Tracking Categories')
                .setDescription('Available categories for player tracking:')
                .setTimestamp();

            Object.entries(TRACKING_CATEGORIES).forEach(([key, category]) => {
                const count = getTrackedPlayersByCategory(key).length;
                embed.addFields({
                    name: `${category.emoji} ${category.name}`,
                    value: `${category.description}\n**Currently tracking:** ${count} player${count !== 1 ? 's' : ''}`,
                    inline: false
                });
            });

            embed.addFields({
                name: '📋 Usage',
                value: 'Use `/track` to add players\nExample: `/track player:Ember category:enemies reason:Hostile player`',
                inline: false
            });

            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'startmonitor') {
            // Check admin permissions
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to start monitoring.', ephemeral: true });
            }

            startMonitoring();

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔄 Enhanced Monitoring Started')
                .setDescription('Player tracking has been started for both Royalty RP and Horizon servers. Players will be monitored every 1 minute.')
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'stopmonitor') {
            // Check admin permissions
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to stop monitoring.', ephemeral: true });
            }

            stopMonitoring();

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏹️ Monitoring Stopped')
                .setDescription('Player tracking has been stopped.')
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'setchannel') {
            // Check admin permissions
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to set the log channel.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const channelId = channel.id;
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

            console.log(`📊 Log channel set to: ${channelId}`);
            return await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error handling slash command:', error);
        
        const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
        
        if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    
    // Only respond to slash command references to guide users
    if (content.includes('!')) {
        // Check if user is trying to use old commands
        const oldCommands = ['!track', '!untrack', '!tracked', '!find', '!search', '!players', '!horizon', '!categories', '!startmonitor', '!stopmonitor', '!setchannel', '!help'];
        const usedOldCommand = oldCommands.some(cmd => content.startsWith(cmd));
        
        if (usedOldCommand) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Commands Updated!')
                .setDescription('This bot now uses **Slash Commands** only. The old `!` commands have been removed.')
                .addFields(
                    { name: '🔄 How to Use Slash Commands', value: 'Type `/` in Discord and you\'ll see all available commands with descriptions and options.', inline: false },
                    { name: '📍 Main Commands', value: '• `/track` - Add player to tracking\n• `/untrack` - Remove player from tracking\n• `/tracked` - View tracked players list\n• `/find` - Search for tracked player\n• `/search` - Search player database\n• `/players` - Show Royalty RP players\n• `/horizon` - Show Horizon players\n• `/categories` - View tracking categories', inline: false },
                    { name: '⚙️ Admin Commands', value: '• `/startmonitor` - Start monitoring\n• `/stopmonitor` - Stop monitoring\n• `/setchannel` - Set log channel', inline: false },
                    { name: '✨ Benefits of Slash Commands', value: '• Built-in help and validation\n• Cleaner interface\n• Auto-complete options\n• Better Discord integration', inline: false }
                )
                .setFooter({ text: 'Start typing "/" to see all available commands!' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
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

} // End startBot function
