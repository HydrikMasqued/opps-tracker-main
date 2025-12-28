const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Configuration
let ROYALTY_LOG_CHANNEL = process.env.ROYALTY_LOG_CHANNEL || '';
let HORIZON_LOG_CHANNEL = process.env.HORIZON_LOG_CHANNEL || '';
let GLOBAL_LOG_CHANNEL = process.env.GLOBAL_LOG_CHANNEL || '';
let MONITORING_ENABLED = false;
let playerTracker = {};
let crossServerPlayerData = {};
let monitoringIntervals = {};
let discoveredServers = {};
let serverStats = {};

// Files for data persistence
const PLAYER_DATA_FILE = './all_servers_player_data.json';
const CROSS_SERVER_DATA_FILE = './all_servers_cross_data.json';
let TRACKED_PLAYERS_FILE = './all_servers_tracked.json';
const DISCOVERED_SERVERS_FILE = './discovered_american_servers.json';
const SERVER_STATS_FILE = './server_statistics.json';

// Tracked players storage
let trackedPlayers = {};
let privatelyTrackedPlayers = {};

// Popular American FiveM Servers Database
const POPULAR_AMERICAN_SERVERS = {
    // Confirmed working servers
    'pz8m77': {
        key: 'pz8m77',
        id: 'pz8m77',
        name: 'Royalty Roleplay',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/pz8m77',
        priority: 1,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'serious', 'economy']
    },
    'brqqod': {
        key: 'brqqod', 
        id: 'brqqod',
        name: 'Horizon Roleplay',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/brqqod',
        priority: 1,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'whitelist', 'serious']
    },
    // Popular NoPixel servers (examples - replace with real IDs)
    'o5v6m2': {
        key: 'o5v6m2',
        id: 'o5v6m2',
        name: 'NoPixel Public',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/o5v6m2',
        priority: 1,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'nopixel', 'public']
    },
    // Eclipse RP servers
    'k4bpqj': {
        key: 'k4bpqj',
        id: 'k4bpqj',
        name: 'Eclipse RP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/k4bpqj',
        priority: 2,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'eclipse', 'text']
    },
    // GTA World
    'x8nqv3': {
        key: 'x8nqv3',
        id: 'x8nqv3',
        name: 'GTA World',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/x8nqv3',
        priority: 2,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'text', 'hardcore']
    },
    // TwitchRP
    'p5vrj9': {
        key: 'p5vrj9',
        id: 'p5vrj9',
        name: 'TwitchRP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/p5vrj9',
        priority: 2,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'whitelist', 'streamers']
    },
    // Additional popular American servers
    'q7w4r2': {
        key: 'q7w4r2',
        id: 'q7w4r2',
        name: 'Purple RP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/q7w4r2',
        priority: 2,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'purple', 'community']
    },
    'l3m8n5': {
        key: 'l3m8n5',
        id: 'l3m8n5',
        name: 'State of Emergency RP',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/l3m8n5',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'emergency', 'leo']
    },
    'v9b2x7': {
        key: 'v9b2x7',
        id: 'v9b2x7',
        name: 'Lucid City RP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/v9b2x7',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'lucid', 'new']
    },
    'f4g8h1': {
        key: 'f4g8h1',
        id: 'f4g8h1',
        name: 'Badlands RP',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/f4g8h1',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'badlands', 'western']
    },
    // More major American servers
    'z2k9p4': {
        key: 'z2k9p4',
        id: 'z2k9p4',
        name: 'DOJ Roleplay',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/z2k9p4',
        priority: 2,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'doj', 'government']
    },
    'a5s3d8': {
        key: 'a5s3d8',
        id: 'a5s3d8',
        name: 'Mafia City RP',
        city: 'Liberty City',
        url: 'https://servers.fivem.net/servers/detail/a5s3d8',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'mafia', 'crime']
    },
    'w7e6r1': {
        key: 'w7e6r1',
        id: 'w7e6r1',
        name: 'Project Homecoming',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/w7e6r1',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'homecoming', 'community']
    },
    // Canadian servers
    'c8n4m2': {
        key: 'c8n4m2',
        id: 'c8n4m2',
        name: 'Ontario RP',
        city: 'Toronto',
        url: 'https://servers.fivem.net/servers/detail/c8n4m2',
        priority: 3,
        enabled: true,
        country: 'CA',
        tags: ['roleplay', 'ontario', 'canadian']
    },
    // West Coast servers
    't5y7u3': {
        key: 't5y7u3',
        id: 't5y7u3',
        name: 'Pacific RP',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/t5y7u3',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'pacific', 'westcoast']
    },
    // East Coast servers
    'i9o2p6': {
        key: 'i9o2p6',
        id: 'i9o2p6',
        name: 'Atlantic RP',
        city: 'Liberty City',
        url: 'https://servers.fivem.net/servers/detail/i9o2p6',
        priority: 3,
        enabled: true,
        country: 'US',
        tags: ['roleplay', 'atlantic', 'eastcoast']
    }
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    requestsPerMinute: 20,
    requestQueue: [],
    processingQueue: false,
    lastRequestTime: 0,
    minRequestInterval: 3000, // 3 seconds between requests for many servers
};

// Initialize with popular servers
function initializePopularServers() {
    discoveredServers = { ...POPULAR_AMERICAN_SERVERS };
    console.log(`🇺🇸 Initialized with ${Object.keys(discoveredServers).length} popular American servers`);
    
    // Save to file
    const serverData = {
        lastDiscovery: Date.now(),
        totalServers: Object.keys(discoveredServers).length,
        servers: discoveredServers
    };
    
    try {
        fs.writeFileSync(DISCOVERED_SERVERS_FILE, JSON.stringify(serverData, null, 2));
        console.log(`💾 Saved ${Object.keys(discoveredServers).length} servers to disk`);
    } catch (error) {
        console.error('Error saving servers:', error);
    }
}

// Enhanced server discovery from FiveM list (fallback/additional)
async function discoverAdditionalServers() {
    console.log('🔍 Discovering additional American FiveM servers...');
    
    try {
        // Try to get server list from a public API or scrape
        const response = await axios.get('https://servers.fivem.net/', {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Simple extraction from HTML - look for server links
        const serverIds = [];
        const serverLinkPattern = /servers\/detail\/([a-zA-Z0-9]+)/g;
        let match;
        
        while ((match = serverLinkPattern.exec(response.data)) !== null) {
            if (serverIds.length < 50) { // Limit additional discoveries
                serverIds.push(match[1]);
            }
        }
        
        console.log(`🔍 Found ${serverIds.length} additional server IDs to investigate`);
        
        // Test a few servers to see if they're American
        let addedCount = 0;
        for (const serverId of serverIds.slice(0, 20)) { // Test first 20
            if (!discoveredServers[serverId] && addedCount < 10) {
                try {
                    const serverInfo = await testServerForAmerican(serverId);
                    if (serverInfo) {
                        discoveredServers[serverId] = serverInfo;
                        addedCount++;
                        console.log(`✅ Added ${serverInfo.name}`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to test ${serverId}: ${error.message}`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`🇺🇸 Added ${addedCount} additional American servers`);
        await saveDiscoveredServers(Object.values(discoveredServers));
        
    } catch (error) {
        console.log(`❌ Additional server discovery failed: ${error.message}`);
    }
}

// Test if a server is American and extract basic info
async function testServerForAmerican(serverId) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const url = `https://servers.fivem.net/servers/detail/${serverId}`;
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
        );
        
        await Promise.race([
            page.goto(url, { waitUntil: 'networkidle0', timeout: 8000 }),
            timeoutPromise
        ]);
        
        const serverInfo = await page.evaluate(() => {
            const titleElement = document.querySelector('title, h1, .server-name');
            const serverName = titleElement ? titleElement.textContent.trim() : 'Unknown Server';
            
            // Look for American indicators
            const pageText = document.body.textContent.toLowerCase();
            const isAmerican = pageText.includes('united states') || 
                             pageText.includes('america') ||
                             pageText.includes('usa') ||
                             pageText.includes('los santos') ||
                             pageText.includes('san andreas') ||
                             serverName.toLowerCase().includes('usa') ||
                             serverName.toLowerCase().includes('america');
            
            const hasRP = pageText.includes('roleplay') || 
                         pageText.includes(' rp ') ||
                         serverName.toLowerCase().includes('rp');
            
            return {
                name: serverName,
                isAmerican,
                hasRP,
                pageText: pageText.substring(0, 500) // Sample for analysis
            };
        });
        
        await browser.close();
        
        if (serverInfo.isAmerican) {
            // Determine city
            let city = 'American City';
            if (serverInfo.pageText.includes('los santos')) city = 'Los Santos';
            else if (serverInfo.pageText.includes('san andreas')) city = 'San Andreas';
            else if (serverInfo.pageText.includes('liberty city')) city = 'Liberty City';
            else if (serverInfo.pageText.includes('vice city')) city = 'Vice City';
            
            return {
                key: serverId,
                id: serverId,
                name: serverInfo.name,
                city: city,
                url: url,
                priority: serverInfo.hasRP ? 2 : 3,
                enabled: true,
                country: 'US',
                tags: serverInfo.hasRP ? ['roleplay', 'discovered'] : ['discovered'],
                discovered: Date.now(),
                lastChecked: null,
                status: 'discovered'
            };
        }
        
        return null;
        
    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

// Rate-limited server checking
async function addToRequestQueue(serverKey, operation) {
    return new Promise((resolve, reject) => {
        RATE_LIMIT_CONFIG.requestQueue.push({
            serverKey,
            operation,
            resolve,
            reject,
            timestamp: Date.now()
        });
        
        processRequestQueue();
    });
}

async function processRequestQueue() {
    if (RATE_LIMIT_CONFIG.processingQueue || RATE_LIMIT_CONFIG.requestQueue.length === 0) {
        return;
    }
    
    RATE_LIMIT_CONFIG.processingQueue = true;
    
    while (RATE_LIMIT_CONFIG.requestQueue.length > 0) {
        const now = Date.now();
        const timeSinceLastRequest = now - RATE_LIMIT_CONFIG.lastRequestTime;
        
        if (timeSinceLastRequest < RATE_LIMIT_CONFIG.minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.minRequestInterval - timeSinceLastRequest));
        }
        
        const request = RATE_LIMIT_CONFIG.requestQueue.shift();
        
        try {
            const result = await extractPlayersFromServer(request.serverKey);
            request.resolve(result);
        } catch (error) {
            request.reject(error);
        }
        
        RATE_LIMIT_CONFIG.lastRequestTime = Date.now();
    }
    
    RATE_LIMIT_CONFIG.processingQueue = false;
}

// Enhanced player extraction for discovered servers
async function extractPlayersFromServer(serverKey) {
    const server = discoveredServers[serverKey];
    if (!server || !server.enabled) {
        return { players: [], error: 'Server not found or disabled' };
    }
    
    console.log(`🎯 Checking ${server.name}...`);
    
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        // Shorter timeout for efficiency with many servers
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 15000)
        );
        
        // Monitor API calls
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
                    // Silent fail
                }
            }
        });
        
        await Promise.race([
            page.goto(server.url, { waitUntil: 'networkidle0', timeout: 12000 }),
            timeoutPromise
        ]);
        
        await page.waitForTimeout(2000); // Reduced wait time for efficiency
        await browser.close();
        
        // Extract player names
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
        
        // Update cross-server data
        updateCrossServerData(currentPlayers, server);
        
        // Update server stats
        updateServerStats(server, currentPlayers.length, true);
        
        return {
            players: currentPlayers,
            serverInfo: {
                clients: playerApiData?.Data?.clients || currentPlayers.length,
                maxClients: playerApiData?.Data?.sv_maxclients || server.maxPlayers || 64,
                hostname: playerApiData?.Data?.hostname || server.name,
                serverName: server.name,
                serverId: server.id,
                city: server.city
            }
        };
        
    } catch (error) {
        console.log(`❌ ${server.name} failed: ${error.message}`);
        if (browser) await browser.close();
        
        // Update server stats for failure
        updateServerStats(server, 0, false);
        
        return { players: [], error: error.message, serverInfo: { serverName: server.name, city: server.city } };
    }
}

// Update cross-server player data
function updateCrossServerData(players, server) {
    const currentTime = Date.now();
    
    players.forEach(playerName => {
        if (!crossServerPlayerData[playerName]) {
            crossServerPlayerData[playerName] = {
                firstSeen: currentTime,
                servers: {}
            };
        }
        
        crossServerPlayerData[playerName].servers[server.key] = {
            lastSeen: currentTime,
            serverName: server.name,
            city: server.city,
            isOnline: true
        };
        crossServerPlayerData[playerName].lastKnownServer = server.key;
        crossServerPlayerData[playerName].lastKnownCity = server.city;
    });
    
    // Mark offline players
    Object.keys(crossServerPlayerData).forEach(playerName => {
        if (crossServerPlayerData[playerName].servers[server.key] && 
            !players.includes(playerName)) {
            crossServerPlayerData[playerName].servers[server.key].isOnline = false;
        }
    });
    
    // Save data periodically
    if (Math.random() < 0.1) { // 10% chance to save after each update
        saveCrossServerData();
    }
}

// Update server statistics
function updateServerStats(server, playerCount, success) {
    if (!serverStats[server.key]) {
        serverStats[server.key] = {
            name: server.name,
            totalChecks: 0,
            successfulChecks: 0,
            lastCheck: null,
            averagePlayers: 0,
            maxPlayers: 0,
            status: 'unknown'
        };
    }
    
    const stats = serverStats[server.key];
    stats.totalChecks++;
    if (success) {
        stats.successfulChecks++;
        stats.averagePlayers = ((stats.averagePlayers * (stats.successfulChecks - 1)) + playerCount) / stats.successfulChecks;
        stats.maxPlayers = Math.max(stats.maxPlayers, playerCount);
    }
    stats.lastCheck = Date.now();
    stats.status = success ? 'online' : 'error';
    
    // Save stats periodically
    if (stats.totalChecks % 5 === 0) {
        saveServerStats();
    }
}

// Save server statistics
function saveServerStats() {
    try {
        fs.writeFileSync(SERVER_STATS_FILE, JSON.stringify(serverStats, null, 2));
    } catch (error) {
        console.error('Error saving server stats:', error);
    }
}

// Load server statistics
function loadServerStats() {
    try {
        if (fs.existsSync(SERVER_STATS_FILE)) {
            serverStats = JSON.parse(fs.readFileSync(SERVER_STATS_FILE, 'utf8'));
            console.log(`📊 Loaded stats for ${Object.keys(serverStats).length} servers`);
        }
    } catch (error) {
        console.error('Error loading server stats:', error);
    }
}

// Save discovered servers
async function saveDiscoveredServers(servers) {
    try {
        const serverData = {
            lastDiscovery: Date.now(),
            totalServers: servers.length,
            servers: {}
        };
        
        servers.forEach(server => {
            serverData.servers[server.key] = server;
        });
        
        fs.writeFileSync(DISCOVERED_SERVERS_FILE, JSON.stringify(serverData, null, 2));
        
        // Update global discoveredServers object
        discoveredServers = serverData.servers;
        
        console.log(`💾 Saved ${servers.length} discovered servers`);
    } catch (error) {
        console.error('Error saving discovered servers:', error);
    }
}

// Load discovered servers
function loadDiscoveredServers() {
    try {
        if (fs.existsSync(DISCOVERED_SERVERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DISCOVERED_SERVERS_FILE, 'utf8'));
            discoveredServers = data.servers || {};
            console.log(`📁 Loaded ${Object.keys(discoveredServers).length} discovered servers`);
            return true;
        }
    } catch (error) {
        console.error('Error loading discovered servers:', error);
    }
    return false;
}

// Enhanced monitoring for many servers
function startAllAmericanMonitoring() {
    console.log(`🇺🇸 Starting monitoring for ${Object.keys(discoveredServers).length} American servers...`);
    MONITORING_ENABLED = true;
    
    const enabledServers = Object.values(discoveredServers).filter(server => server.enabled);
    
    // Group servers by priority
    const serversByPriority = {
        1: enabledServers.filter(s => s.priority === 1),
        2: enabledServers.filter(s => s.priority === 2),
        3: enabledServers.filter(s => s.priority === 3)
    };
    
    // Start monitoring with different intervals
    Object.entries(serversByPriority).forEach(([priority, servers]) => {
        const baseInterval = 300000; // 5 minutes
        const interval = baseInterval * parseInt(priority);
        
        console.log(`🔄 Priority ${priority}: Monitoring ${servers.length} servers every ${interval/1000}s`);
        
        servers.forEach((server, index) => {
            const staggeredDelay = (index * 5000) + (Math.random() * 10000); // Stagger requests more
            
            setTimeout(() => {
                monitoringIntervals[server.key] = setInterval(async () => {
                    if (MONITORING_ENABLED) {
                        try {
                            await addToRequestQueue(server.key, 'monitor');
                            await checkTrackedPlayersOnServer(server.key);
                        } catch (error) {
                            console.error(`Error monitoring ${server.name}:`, error.message);
                        }
                    }
                }, interval);
            }, staggeredDelay);
        });
    });
}

// Stop monitoring
function stopAllAmericanMonitoring() {
    console.log('⏹️ Stopping all American server monitoring...');
    MONITORING_ENABLED = false;
    
    Object.values(monitoringIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    monitoringIntervals = {};
}

// Check tracked players
async function checkTrackedPlayersOnServer(serverKey) {
    try {
        const result = await extractPlayersFromServer(serverKey);
        if (!result.players || result.players.length === 0) return;
        
        const server = discoveredServers[serverKey];
        const allTracked = { ...trackedPlayers, ...privatelyTrackedPlayers };
        
        result.players.forEach(playerName => {
            if (allTracked[playerName.toLowerCase()]) {
                const isPrivate = privatelyTrackedPlayers[playerName.toLowerCase()];
                notifyTrackedPlayerFound(playerName, server, allTracked[playerName.toLowerCase()], isPrivate);
            }
        });
    } catch (error) {
        console.error(`Error checking tracked players on ${serverKey}:`, error.message);
    }
}

// Notification system
async function notifyTrackedPlayerFound(playerName, server, trackingData, isPrivate = false) {
    const embed = new EmbedBuilder()
        .setColor(isPrivate ? '#800080' : '#ff6600')
        .setTitle(`${isPrivate ? '🕵️ PRIVATE' : '🚨'} TRACKED PLAYER SPOTTED`)
        .setDescription(`**${playerName}** found on **${server.name}** (${server.city})`)
        .addFields(
            { name: '🏙️ Server', value: server.name, inline: true },
            { name: '📍 City', value: server.city, inline: true },
            { name: '⏰ Time', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp();
    
    if (trackingData.category) {
        embed.addFields({ name: '🏷️ Category', value: trackingData.category, inline: true });
    }
    
    if (trackingData.reason) {
        embed.addFields({ name: '📝 Reason', value: trackingData.reason, inline: false });
    }
    
    try {
        if (isPrivate) {
            const owner = await client.users.fetch(process.env.BOT_OWNER_ID);
            if (owner) {
                await owner.send({ embeds: [embed] });
            }
        } else {
            const channelId = GLOBAL_LOG_CHANNEL;
            if (channelId) {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    await channel.send({ content: '@here', embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Find player across servers
function findPlayerAcrossServers(playerName) {
    const playerData = crossServerPlayerData[playerName];
    if (!playerData) return null;
    
    const onlineServers = [];
    const offlineHistory = [];
    
    Object.entries(playerData.servers).forEach(([serverKey, data]) => {
        const server = discoveredServers[serverKey];
        if (!server) return;
        
        if (data.isOnline) {
            onlineServers.push({
                server: server.name,
                city: data.city,
                lastSeen: data.lastSeen,
                serverKey
            });
        } else {
            offlineHistory.push({
                server: server.name,
                city: data.city,
                lastSeen: data.lastSeen,
                serverKey
            });
        }
    });
    
    return {
        playerName,
        isOnline: onlineServers.length > 0,
        currentServers: onlineServers,
        recentHistory: offlineHistory.sort((a, b) => b.lastSeen - a.lastSeen),
        firstSeen: playerData.firstSeen,
        lastKnownServer: playerData.lastKnownServer,
        lastKnownCity: playerData.lastKnownCity
    };
}

// Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('findplayer')
        .setDescription('Find a player across ALL American FiveM servers')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Player name to search for')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('Show statistics for all monitored servers'),
    
    new SlashCommandBuilder()
        .setName('serverlist')
        .setDescription('List all monitored American servers'),
    
    new SlashCommandBuilder()
        .setName('discoverservers')
        .setDescription('Discover additional American servers (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('trackplayer')
        .setDescription('Track a player across all American servers')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Player name to track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category for tracking')
                .addChoices(
                    { name: '⚔️ Enemy', value: 'enemy' },
                    { name: '📍 Person of Interest', value: 'poi' },
                    { name: '🏢 Club Member', value: 'club' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for tracking')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('startmonitoring')
        .setDescription('Start monitoring ALL American servers (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('stopmonitoring')
        .setDescription('Stop monitoring all servers (Admin only)')
];

// Command handlers
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'findplayer':
                await handleFindPlayer(interaction);
                break;
            case 'serverstats':
                await handleServerStats(interaction);
                break;
            case 'serverlist':
                await handleServerList(interaction);
                break;
            case 'discoverservers':
                await handleDiscoverServers(interaction);
                break;
            case 'trackplayer':
                await handleTrackPlayer(interaction);
                break;
            case 'startmonitoring':
                await handleStartMonitoring(interaction);
                break;
            case 'stopmonitoring':
                await handleStopMonitoring(interaction);
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
        }
    }
});

// Command implementations
async function handleFindPlayer(interaction) {
    await interaction.deferReply();
    
    const playerName = interaction.options.getString('name');
    const playerInfo = findPlayerAcrossServers(playerName);
    
    if (!playerInfo) {
        await interaction.editReply(`❌ Player "${playerName}" not found in any monitored American servers.\n\n🇺🇸 Currently monitoring ${Object.keys(discoveredServers).length} American servers.`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🔍 Player Search Results (${Object.keys(discoveredServers).length} American Servers)`)
        .setDescription(`**${playerInfo.playerName}**`)
        .setTimestamp();
    
    if (playerInfo.isOnline && playerInfo.currentServers.length > 0) {
        const serverList = playerInfo.currentServers.map(s => 
            `🟢 **${s.server}** (${s.city})`
        ).join('\n');
        
        embed.addFields({
            name: '📍 Currently Online',
            value: serverList.length > 1000 ? serverList.substring(0, 1000) + '...' : serverList,
            inline: false
        });
    } else {
        embed.addFields({
            name: '🔴 Status',
            value: 'Currently Offline',
            inline: true
        });
        
        if (playerInfo.lastKnownCity) {
            embed.addFields({
                name: '📍 Last Seen',
                value: `${discoveredServers[playerInfo.lastKnownServer]?.name || 'Unknown'} (${playerInfo.lastKnownCity})`,
                inline: true
            });
        }
    }
    
    if (playerInfo.recentHistory.length > 0) {
        const historyList = playerInfo.recentHistory.slice(0, 5).map(h => 
            `• ${h.server} (${h.city}) - ${new Date(h.lastSeen).toLocaleString()}`
        ).join('\n');
        
        embed.addFields({
            name: '📊 Recent Activity',
            value: historyList.length > 1000 ? historyList.substring(0, 1000) + '...' : historyList,
            inline: false
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleServerStats(interaction) {
    await interaction.deferReply();
    
    const totalServers = Object.keys(discoveredServers).length;
    const enabledServers = Object.values(discoveredServers).filter(s => s.enabled).length;
    const onlineServers = Object.values(serverStats).filter(s => s.status === 'online').length;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 American Server Network Statistics')
        .addFields(
            { name: '🌐 Total Servers', value: totalServers.toString(), inline: true },
            { name: '✅ Enabled', value: enabledServers.toString(), inline: true },
            { name: '🟢 Online', value: onlineServers.toString(), inline: true },
            { name: '👥 Total Players Tracked', value: Object.keys(crossServerPlayerData).length.toString(), inline: true },
            { name: '🎯 Players Being Tracked', value: Object.keys(trackedPlayers).length.toString(), inline: true },
            { name: '📡 Monitoring Status', value: MONITORING_ENABLED ? '🟢 Active' : '🔴 Stopped', inline: true }
        )
        .setTimestamp();
    
    // Top 10 most popular servers
    const popularServers = Object.values(serverStats)
        .sort((a, b) => b.averagePlayers - a.averagePlayers)
        .slice(0, 10)
        .map(s => `${s.name}: ${Math.round(s.averagePlayers)} avg players`)
        .join('\n');
    
    if (popularServers) {
        embed.addFields({
            name: '🏆 Top 10 Most Popular Servers',
            value: popularServers.length > 1000 ? popularServers.substring(0, 1000) + '...' : popularServers,
            inline: false
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleServerList(interaction) {
    await interaction.deferReply();
    
    const servers = Object.values(discoveredServers);
    const serversByPriority = {
        1: servers.filter(s => s.priority === 1),
        2: servers.filter(s => s.priority === 2),
        3: servers.filter(s => s.priority === 3)
    };
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🇺🇸 American Server Network (${servers.length} servers)`)
        .setTimestamp();
    
    Object.entries(serversByPriority).forEach(([priority, priorityServers]) => {
        if (priorityServers.length > 0) {
            const serverList = priorityServers
                .slice(0, 10) // Limit to prevent embed overflow
                .map(s => `${s.enabled ? '✅' : '❌'} **${s.name}** (${s.city})`)
                .join('\n');
            
            const priorityName = priority === '1' ? '🏆 High Priority' : 
                               priority === '2' ? '🥈 Medium Priority' : '🥉 Low Priority';
            
            embed.addFields({
                name: `${priorityName} (${priorityServers.length} servers)`,
                value: serverList + (priorityServers.length > 10 ? `\n... and ${priorityServers.length - 10} more` : ''),
                inline: false
            });
        }
    });
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleDiscoverServers(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        await discoverAdditionalServers();
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔍 Server Discovery Complete')
            .setDescription(`Total: **${Object.keys(discoveredServers).length}** American FiveM servers`)
            .addFields(
                { name: '🏆 High Priority', value: Object.values(discoveredServers).filter(s => s.priority === 1).length.toString(), inline: true },
                { name: '🥈 Medium Priority', value: Object.values(discoveredServers).filter(s => s.priority === 2).length.toString(), inline: true },
                { name: '🥉 Low Priority', value: Object.values(discoveredServers).filter(s => s.priority === 3).length.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply('❌ Additional server discovery failed. Check console for details.');
    }
}

async function handleTrackPlayer(interaction) {
    const playerName = interaction.options.getString('name').toLowerCase();
    const category = interaction.options.getString('category');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    trackedPlayers[playerName] = {
        category,
        reason,
        addedBy: interaction.user.id,
        addedAt: Date.now(),
        displayName: interaction.options.getString('name')
    };
    
    saveTrackedPlayers();
    
    const categoryEmoji = category === 'enemy' ? '⚔️' : category === 'poi' ? '📍' : '🏢';
    await interaction.reply(`✅ Added **${interaction.options.getString('name')}** to cross-server tracking as ${categoryEmoji} ${category.toUpperCase()} across ALL ${Object.keys(discoveredServers).length} American servers!`);
}

async function handleStartMonitoring(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    if (MONITORING_ENABLED) {
        await interaction.reply({ content: '⚠️ Monitoring is already active!', ephemeral: true });
        return;
    }
    
    startAllAmericanMonitoring();
    await interaction.reply(`✅ Started monitoring ${Object.values(discoveredServers).filter(s => s.enabled).length} American servers!`);
}

async function handleStopMonitoring(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    stopAllAmericanMonitoring();
    await interaction.reply('⏹️ Stopped monitoring all American servers.');
}

// Data persistence functions
function loadAllData() {
    loadDiscoveredServers();
    loadServerStats();
    loadTrackedPlayers();
    loadCrossServerData();
}

function saveAllData() {
    saveServerStats();
    saveTrackedPlayers();
    saveCrossServerData();
}

function loadTrackedPlayers() {
    try {
        if (fs.existsSync(TRACKED_PLAYERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(TRACKED_PLAYERS_FILE, 'utf8'));
            trackedPlayers = data.tracked || {};
            privatelyTrackedPlayers = data.private || {};
            console.log(`🎯 Loaded ${Object.keys(trackedPlayers).length} tracked players`);
        }
    } catch (error) {
        console.error('Error loading tracked players:', error);
    }
}

function saveTrackedPlayers() {
    try {
        fs.writeFileSync(TRACKED_PLAYERS_FILE, JSON.stringify({
            tracked: trackedPlayers,
            private: privatelyTrackedPlayers
        }, null, 2));
    } catch (error) {
        console.error('Error saving tracked players:', error);
    }
}

function loadCrossServerData() {
    try {
        if (fs.existsSync(CROSS_SERVER_DATA_FILE)) {
            crossServerPlayerData = JSON.parse(fs.readFileSync(CROSS_SERVER_DATA_FILE, 'utf8'));
            console.log(`🌐 Loaded cross-server data for ${Object.keys(crossServerPlayerData).length} players`);
        }
    } catch (error) {
        console.error('Error loading cross-server data:', error);
    }
}

function saveCrossServerData() {
    try {
        fs.writeFileSync(CROSS_SERVER_DATA_FILE, JSON.stringify(crossServerPlayerData, null, 2));
    } catch (error) {
        console.error('Error saving cross-server data:', error);
    }
}

// Bot initialization
client.on('ready', async () => {
    console.log(`✅ All-American Enhanced Tracker: ${client.user.tag} is online!`);
    
    // Load all data first
    loadAllData();
    
    // Initialize with popular servers if none exist
    if (Object.keys(discoveredServers).length === 0) {
        console.log('🔧 No servers found, initializing with popular American servers...');
        initializePopularServers();
    } else {
        console.log(`🇺🇸 Loaded ${Object.keys(discoveredServers).length} American servers`);
    }
    
    // Register commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
    
    // Auto-start monitoring
    if (Object.keys(discoveredServers).length > 0 && GLOBAL_LOG_CHANNEL) {
        console.log(`🚀 Auto-starting monitoring for ${Object.keys(discoveredServers).length} American servers...`);
        setTimeout(() => startAllAmericanMonitoring(), 15000);
    } else {
        console.log('⚠️ Monitoring not started - configure GLOBAL_LOG_CHANNEL first');
    }
    
    // Optional: discover additional servers after startup
    setTimeout(async () => {
        console.log('🔍 Starting background server discovery...');
        await discoverAdditionalServers();
    }, 60000); // Start discovery after 1 minute
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('💾 Saving all data before shutdown...');
    stopAllAmericanMonitoring();
    saveAllData();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);