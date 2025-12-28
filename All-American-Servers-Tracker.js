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
const TRACKED_PLAYERS_FILE = './all_servers_tracked.json';
const DISCOVERED_SERVERS_FILE = './discovered_american_servers.json';
const SERVER_STATS_FILE = './server_statistics.json';

// Tracked players storage
let trackedPlayers = {};
let privatelyTrackedPlayers = {};

// Server discovery configuration
const SERVER_DISCOVERY_CONFIG = {
    maxServers: 100, // Start with 100 servers to test
    countries: ['US', 'USA', 'United States', 'America', 'CA', 'Canada'],
    excludeKeywords: ['test', 'dev', 'private', 'whitelist', 'closed'],
    minPlayers: 1, // Only include servers with at least 1 player
    maxPlayers: 1000, // Reasonable upper limit
    priorityKeywords: ['roleplay', 'rp', 'city', 'county', 'police', 'gang'],
    discoveryInterval: 24 * 60 * 60 * 1000, // Rediscover servers every 24 hours
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    requestsPerMinute: 30,
    requestQueue: [],
    processingQueue: false,
    lastRequestTime: 0,
    minRequestInterval: 2000, // 2 seconds between requests
};

// Enhanced server discovery system
async function discoverAmericanServers() {
    console.log('🔍 Starting discovery of American FiveM servers...');
    
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
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navigate to FiveM server list
        await page.goto('https://servers.fivem.net/', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        
        await page.waitForTimeout(5000);
        
        // Extract server data
        const serverData = await page.evaluate(() => {
            const servers = [];
            
            // Try to find server elements - this will need to be updated based on the actual page structure
            const serverElements = document.querySelectorAll('.server-row, .server-item, .server-card, [data-server-id]');
            
            serverElements.forEach((element, index) => {
                if (index >= 200) return; // Limit initial discovery
                
                try {
                    const serverInfo = {
                        id: null,
                        name: null,
                        players: 0,
                        maxPlayers: 0,
                        country: null,
                        tags: [],
                        url: null
                    };
                    
                    // Extract server ID from various possible attributes
                    serverInfo.id = element.getAttribute('data-server-id') || 
                                   element.getAttribute('data-id') ||
                                   element.querySelector('[data-server-id]')?.getAttribute('data-server-id');
                    
                    // Extract server name
                    const nameElement = element.querySelector('.server-name, .name, .title, h3, h4') ||
                                       element.querySelector('[title]');
                    if (nameElement) {
                        serverInfo.name = nameElement.textContent?.trim() || nameElement.getAttribute('title');
                    }
                    
                    // Extract player count
                    const playersElement = element.querySelector('.players, .player-count, .clients');
                    if (playersElement) {
                        const playersText = playersElement.textContent || '';
                        const playersMatch = playersText.match(/(\d+)\s*\/\s*(\d+)/);
                        if (playersMatch) {
                            serverInfo.players = parseInt(playersMatch[1]);
                            serverInfo.maxPlayers = parseInt(playersMatch[2]);
                        }
                    }
                    
                    // Extract country/location
                    const countryElement = element.querySelector('.country, .location, .flag') ||
                                         element.querySelector('[data-country]');
                    if (countryElement) {
                        serverInfo.country = countryElement.textContent?.trim() || 
                                           countryElement.getAttribute('data-country') ||
                                           countryElement.getAttribute('title');
                    }
                    
                    // Extract tags
                    const tagElements = element.querySelectorAll('.tag, .badge, .category');
                    tagElements.forEach(tag => {
                        if (tag.textContent?.trim()) {
                            serverInfo.tags.push(tag.textContent.trim().toLowerCase());
                        }
                    });
                    
                    // Create URL if we have an ID
                    if (serverInfo.id) {
                        serverInfo.url = `https://servers.fivem.net/servers/detail/${serverInfo.id}`;
                    }
                    
                    // Only add if we have essential data
                    if (serverInfo.id && serverInfo.name) {
                        servers.push(serverInfo);
                    }
                } catch (error) {
                    console.log(`Error extracting server data:`, error.message);
                }
            });
            
            return servers;
        });
        
        await browser.close();
        
        // Filter for American servers
        const americanServers = await filterAmericanServers(serverData);
        
        console.log(`🇺🇸 Discovered ${americanServers.length} American FiveM servers`);
        
        // Save discovered servers
        await saveDiscoveredServers(americanServers);
        
        return americanServers;
        
    } catch (error) {
        console.error('❌ Server discovery failed:', error.message);
        if (browser) await browser.close();
        return [];
    }
}

// Filter servers for American/North American servers
async function filterAmericanServers(servers) {
    const americanServers = [];
    
    for (const server of servers) {
        // Check country
        const isAmerican = SERVER_DISCOVERY_CONFIG.countries.some(country => 
            server.country?.toLowerCase().includes(country.toLowerCase())
        );
        
        // Check server name for American indicators
        const nameIndicatesAmerican = SERVER_DISCOVERY_CONFIG.countries.some(country =>
            server.name?.toLowerCase().includes(country.toLowerCase())
        ) || server.name?.toLowerCase().includes('los santos') ||
            server.name?.toLowerCase().includes('san andreas') ||
            server.name?.toLowerCase().includes('liberty city');
        
        // Check for excluded keywords
        const hasExcludedKeywords = SERVER_DISCOVERY_CONFIG.excludeKeywords.some(keyword =>
            server.name?.toLowerCase().includes(keyword)
        );
        
        // Check player count requirements
        const meetsPlayerRequirements = server.players >= SERVER_DISCOVERY_CONFIG.minPlayers &&
                                       server.players <= SERVER_DISCOVERY_CONFIG.maxPlayers;
        
        // Priority boost for roleplay servers
        const isPriority = SERVER_DISCOVERY_CONFIG.priorityKeywords.some(keyword =>
            server.name?.toLowerCase().includes(keyword) ||
            server.tags?.some(tag => tag.includes(keyword))
        );
        
        if ((isAmerican || nameIndicatesAmerican) && !hasExcludedKeywords && meetsPlayerRequirements) {
            // Determine city/location
            let city = 'Unknown';
            if (server.name?.toLowerCase().includes('los santos')) city = 'Los Santos';
            else if (server.name?.toLowerCase().includes('san andreas')) city = 'San Andreas';
            else if (server.name?.toLowerCase().includes('liberty city')) city = 'Liberty City';
            else if (server.name?.toLowerCase().includes('vice city')) city = 'Vice City';
            else city = 'American City';
            
            // Determine priority based on player count and keywords
            let priority = 3; // Default low priority
            if (server.players > 50) priority = 1; // High priority for popular servers
            else if (server.players > 20 || isPriority) priority = 2; // Medium priority
            
            americanServers.push({
                key: server.id,
                id: server.id,
                name: server.name,
                city: city,
                url: server.url,
                priority: priority,
                enabled: true,
                players: server.players,
                maxPlayers: server.maxPlayers,
                country: server.country,
                tags: server.tags,
                discovered: Date.now(),
                lastChecked: null,
                status: 'discovered'
            });
        }
    }
    
    // Sort by priority and player count
    americanServers.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.players - a.players;
    });
    
    // Limit to configured maximum
    return americanServers.slice(0, SERVER_DISCOVERY_CONFIG.maxServers);
}

// Alternative: Try to use FiveM API if available
async function tryFiveMAPI() {
    try {
        console.log('🔌 Attempting to use FiveM API...');
        
        // Try the API endpoint (this might not exist, but worth trying)
        const response = await axios.get('https://servers-frontend.fivem.net/api/servers/', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && Array.isArray(response.data)) {
            console.log(`📡 Found ${response.data.length} servers via API`);
            
            const americanServers = response.data
                .filter(server => {
                    // Filter for American servers
                    const isAmerican = server.locale === 'en-US' ||
                                     server.locale === 'en-CA' ||
                                     (server.vars && (
                                         server.vars.country === 'US' ||
                                         server.vars.country === 'USA' ||
                                         server.vars.country === 'CA'
                                     ));
                    
                    const hasPlayers = (server.clients || 0) >= SERVER_DISCOVERY_CONFIG.minPlayers;
                    
                    return isAmerican && hasPlayers;
                })
                .slice(0, SERVER_DISCOVERY_CONFIG.maxServers)
                .map(server => ({
                    key: server.EndPoint || server.id,
                    id: server.EndPoint || server.id,
                    name: server.hostname || server.name || 'Unknown Server',
                    city: 'American City',
                    url: `https://servers.fivem.net/servers/detail/${server.EndPoint || server.id}`,
                    priority: (server.clients || 0) > 50 ? 1 : (server.clients || 0) > 20 ? 2 : 3,
                    enabled: true,
                    players: server.clients || 0,
                    maxPlayers: server.sv_maxclients || 64,
                    country: server.vars?.country || 'US',
                    tags: [],
                    discovered: Date.now(),
                    lastChecked: null,
                    status: 'api-discovered'
                }));
            
            return americanServers;
        }
    } catch (error) {
        console.log('❌ FiveM API not available:', error.message);
    }
    
    return null;
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
            setTimeout(() => reject(new Error('Timeout')), 20000)
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
            page.goto(server.url, { waitUntil: 'networkidle0', timeout: 15000 }),
            timeoutPromise
        ]);
        
        await page.waitForTimeout(3000); // Reduced wait time for efficiency
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
                maxClients: playerApiData?.Data?.sv_maxclients || server.maxPlayers,
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
    if (stats.totalChecks % 10 === 0) {
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
            const staggeredDelay = (index * 2000) + (Math.random() * 5000); // Stagger requests
            
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
        if (!result.players) return;
        
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

// Notification system (reuse from previous version)
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

// Enhanced slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('findplayer')
        .setDescription('Find a player across ALL American FiveM servers')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Player name to search for')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('discoverservers')
        .setDescription('Discover new American FiveM servers (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('Show statistics for all monitored servers'),
    
    new SlashCommandBuilder()
        .setName('enableserver')
        .setDescription('Enable monitoring for a specific server (Admin only)')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Server name or ID')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('disableserver')
        .setDescription('Disable monitoring for a specific server (Admin only)')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Server name or ID')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('trackplayer')
        .setDescription('Add a player to cross-server tracking')
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

// Enhanced command handlers
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'findplayer':
                await handleFindPlayer(interaction);
                break;
            case 'discoverservers':
                await handleDiscoverServers(interaction);
                break;
            case 'serverstats':
                await handleServerStats(interaction);
                break;
            case 'enableserver':
                await handleEnableServer(interaction);
                break;
            case 'disableserver':
                await handleDisableServer(interaction);
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

// Command handler implementations
async function handleFindPlayer(interaction) {
    await interaction.deferReply();
    
    const playerName = interaction.options.getString('name');
    const playerInfo = findPlayerAcrossServers(playerName);
    
    if (!playerInfo) {
        await interaction.editReply(`❌ Player "${playerName}" not found in any monitored American servers.`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🔍 Player Search Results (American Servers)`)
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

async function handleDiscoverServers(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    await interaction.deferReply();
    
    try {
        // Try API first, then web scraping
        let servers = await tryFiveMAPI();
        if (!servers || servers.length === 0) {
            servers = await discoverAmericanServers();
        }
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔍 Server Discovery Complete')
            .setDescription(`Found **${servers.length}** American FiveM servers`)
            .addFields(
                { name: '🏆 High Priority', value: servers.filter(s => s.priority === 1).length.toString(), inline: true },
                { name: '🥈 Medium Priority', value: servers.filter(s => s.priority === 2).length.toString(), inline: true },
                { name: '🥉 Low Priority', value: servers.filter(s => s.priority === 3).length.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply('❌ Server discovery failed. Check console for details.');
    }
}

async function handleServerStats(interaction) {
    await interaction.deferReply();
    
    const totalServers = Object.keys(discoveredServers).length;
    const enabledServers = Object.values(discoveredServers).filter(s => s.enabled).length;
    const onlineServers = Object.values(serverStats).filter(s => s.status === 'online').length;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 American Server Statistics')
        .addFields(
            { name: '🌐 Total Discovered', value: totalServers.toString(), inline: true },
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

// Other necessary functions (simplified for brevity)
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
    await interaction.reply(`✅ Added **${interaction.options.getString('name')}** to cross-server tracking as ${categoryEmoji} ${category.toUpperCase()} across ALL American servers!`);
}

// Data persistence functions (simplified)
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
    console.log(`✅ All-American Tracker: ${client.user.tag} is online!`);
    
    // Load all data
    loadAllData();
    
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
    
    // Discover servers if not already done recently
    if (Object.keys(discoveredServers).length === 0) {
        console.log('🔍 No servers found, starting discovery...');
        try {
            let servers = await tryFiveMAPI();
            if (!servers || servers.length === 0) {
                servers = await discoverAmericanServers();
            }
            console.log(`🇺🇸 Discovery complete: ${servers.length} servers found`);
        } catch (error) {
            console.error('Initial server discovery failed:', error);
        }
    } else {
        console.log(`🇺🇸 Loaded ${Object.keys(discoveredServers).length} discovered servers`);
    }
    
    // Auto-start monitoring
    if (Object.keys(discoveredServers).length > 0 && (GLOBAL_LOG_CHANNEL || ROYALTY_LOG_CHANNEL)) {
        console.log('🚀 Auto-starting American server monitoring...');
        setTimeout(() => startAllAmericanMonitoring(), 10000);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('💾 Saving all data before shutdown...');
    stopAllAmericanMonitoring();
    saveAllData();
    process.exit(0);
});

// Additional error handling and stubs for missing functions
async function handleEnableServer(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    const serverQuery = interaction.options.getString('server').toLowerCase();
    const server = Object.values(discoveredServers).find(s => 
        s.name.toLowerCase().includes(serverQuery) || s.id === serverQuery
    );
    
    if (!server) {
        await interaction.reply({ content: '❌ Server not found.', ephemeral: true });
        return;
    }
    
    server.enabled = true;
    await saveDiscoveredServers(Object.values(discoveredServers));
    await interaction.reply(`✅ Enabled monitoring for **${server.name}**`);
}

async function handleDisableServer(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ Admin permissions required.', ephemeral: true });
        return;
    }
    
    const serverQuery = interaction.options.getString('server').toLowerCase();
    const server = Object.values(discoveredServers).find(s => 
        s.name.toLowerCase().includes(serverQuery) || s.id === serverQuery
    );
    
    if (!server) {
        await interaction.reply({ content: '❌ Server not found.', ephemeral: true });
        return;
    }
    
    server.enabled = false;
    await saveDiscoveredServers(Object.values(discoveredServers));
    await interaction.reply(`⏹️ Disabled monitoring for **${server.name}**`);
}

client.login(process.env.DISCORD_TOKEN);