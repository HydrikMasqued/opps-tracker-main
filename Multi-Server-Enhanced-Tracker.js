const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
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

// Enhanced server configurations - easily expandable
const SERVERS = {
    royalty: {
        id: 'pz8m77',
        name: 'Royalty RP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/pz8m77',
        priority: 1, // Higher priority = more frequent checks
        enabled: true
    },
    horizon: {
        id: 'brqqod',
        name: 'Horizon',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/brqqod',
        priority: 2,
        enabled: true
    },
    nopixel: {
        id: 'p5vrj9', // Example NoPixel server ID
        name: 'NoPixel',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/p5vrj9',
        priority: 1,
        enabled: false
    },
    eclipse: {
        id: 'k4bpqj', // Example Eclipse RP server ID
        name: 'Eclipse RP',
        city: 'Los Santos',
        url: 'https://servers.fivem.net/servers/detail/k4bpqj',
        priority: 2,
        enabled: false
    },
    grandtheftrp: {
        id: 'x8nqv3', // Example GTA World server ID
        name: 'GTA World',
        city: 'San Andreas',
        url: 'https://servers.fivem.net/servers/detail/x8nqv3',
        priority: 3,
        enabled: false
    },
    elyxir: {
        id: 'jad794',
        name: 'Elyxir',
        city: 'Elyxir',
        url: 'https://servers.fivem.net/servers/detail/jad794',
        priority: 2,
        enabled: true
    }
};

// Configuration
let ROYALTY_LOG_CHANNEL = process.env.ROYALTY_LOG_CHANNEL || '';
let HORIZON_LOG_CHANNEL = process.env.HORIZON_LOG_CHANNEL || '';
let ELYXIR_LOG_CHANNEL = process.env.ELYXIR_LOG_CHANNEL || '';
let GLOBAL_LOG_CHANNEL = process.env.GLOBAL_LOG_CHANNEL || '';
let MONITORING_ENABLED = false;
let playerTracker = {};
let crossServerPlayerData = {}; // Track players across all servers
let monitoringIntervals = {};

// Files for data persistence
const PLAYER_DATA_FILE = './multi_server_player_data.json';
const CROSS_SERVER_DATA_FILE = './cross_server_player_data.json';
const TRACKED_PLAYERS_FILE = './tracked_players_multi.json';

// Tracked players storage
let trackedPlayers = {};
let privatelyTrackedPlayers = {};

// Per-server player tracking for join/leave detection
let serverPlayerStates = {
    royalty: {},
    horizon: {},
    elyxir: {}
};

// Load existing data on startup
function loadAllData() {
    loadPlayerData();
    loadCrossServerData();
    loadTrackedPlayers();
}

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

function loadCrossServerData() {
    try {
        if (fs.existsSync(CROSS_SERVER_DATA_FILE)) {
            const data = fs.readFileSync(CROSS_SERVER_DATA_FILE, 'utf8');
            crossServerPlayerData = JSON.parse(data);
            console.log(`🌐 Loaded cross-server data for ${Object.keys(crossServerPlayerData).length} players`);
        }
    } catch (error) {
        console.error('Error loading cross-server data:', error);
        crossServerPlayerData = {};
    }
}

function loadTrackedPlayers() {
    try {
        if (fs.existsSync(TRACKED_PLAYERS_FILE)) {
            const data = fs.readFileSync(TRACKED_PLAYERS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            trackedPlayers = parsed.tracked || {};
            privatelyTrackedPlayers = parsed.private || {};
            console.log(`🎯 Loaded ${Object.keys(trackedPlayers).length} tracked players and ${Object.keys(privatelyTrackedPlayers).length} private players`);
        }
    } catch (error) {
        console.error('Error loading tracked players:', error);
        trackedPlayers = {};
        privatelyTrackedPlayers = {};
    }
}

// Save data functions
function savePlayerData() {
    try {
        fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(playerTracker, null, 2));
    } catch (error) {
        console.error('Error saving player data:', error);
    }
}

function saveCrossServerData() {
    try {
        fs.writeFileSync(CROSS_SERVER_DATA_FILE, JSON.stringify(crossServerPlayerData, null, 2));
    } catch (error) {
        console.error('Error saving cross-server data:', error);
    }
}

function saveTrackedPlayers() {
    try {
        const data = {
            tracked: trackedPlayers,
            private: privatelyTrackedPlayers
        };
        fs.writeFileSync(TRACKED_PLAYERS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving tracked players:', error);
    }
}

// Utility functions
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

// Enhanced player extraction for multiple servers
async function extractPlayersFromServer(serverKey) {
    const server = SERVERS[serverKey];
    if (!server || !server.enabled) {
        return { players: [], error: 'Server not configured or disabled' };
    }
    
    console.log(`🎯 Checking ${server.name} (${server.city})...`);
    
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
        
        // Set shorter timeout for efficiency
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 30000)
        );
        
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
                    // Silent fail for API parsing
                }
            }
        });
        
        await Promise.race([
            page.goto(server.url, { waitUntil: 'networkidle0', timeout: 25000 }),
            timeoutPromise
        ]);
        
        await page.waitForTimeout(5000); // Reduced wait time
        await browser.close();
        
        // Extract and filter player names
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
        
        // Update cross-server player data
        const currentTime = Date.now();
        currentPlayers.forEach(playerName => {
            if (!crossServerPlayerData[playerName]) {
                crossServerPlayerData[playerName] = {
                    firstSeen: currentTime,
                    servers: {}
                };
            }
            
            crossServerPlayerData[playerName].servers[serverKey] = {
                lastSeen: currentTime,
                serverName: server.name,
                city: server.city,
                isOnline: true
            };
            crossServerPlayerData[playerName].lastKnownServer = serverKey;
            crossServerPlayerData[playerName].lastKnownCity = server.city;
        });
        
        // Detect joins and leaves for this server
        await detectPlayerChanges(serverKey, currentPlayers);
        
        // Mark players as offline for this server if they're not in current list
        Object.keys(crossServerPlayerData).forEach(playerName => {
            if (crossServerPlayerData[playerName].servers[serverKey] && 
                !currentPlayers.includes(playerName)) {
                crossServerPlayerData[playerName].servers[serverKey].isOnline = false;
            }
        });
        
        saveCrossServerData();
        
        return {
            players: currentPlayers,
            serverInfo: {
                clients: playerApiData?.Data?.clients || 0,
                maxClients: playerApiData?.Data?.sv_maxclients || 0,
                hostname: playerApiData?.Data?.hostname || server.name,
                serverName: server.name,
                serverId: server.id,
                city: server.city
            }
        };
        
    } catch (error) {
        console.log(`❌ ${server.name} extraction failed: ${error.message}`);
        if (browser) await browser.close();
        return { players: [], error: error.message, serverInfo: { serverName: server.name, city: server.city } };
    }
}

// Detect player joins and leaves
async function detectPlayerChanges(serverKey, currentPlayers) {
    const server = SERVERS[serverKey];
    const previousPlayers = Object.keys(serverPlayerStates[serverKey] || {});
    const currentTime = Date.now();
    
    // Initialize server state if it doesn't exist
    if (!serverPlayerStates[serverKey]) {
        serverPlayerStates[serverKey] = {};
    }
    
    // Detect new joins
    for (const playerName of currentPlayers) {
        if (!serverPlayerStates[serverKey][playerName]) {
            // New player joined
            serverPlayerStates[serverKey][playerName] = {
                joinTime: currentTime,
                isOnline: true
            };
            
            console.log(`✅ [${server.name}] Player joined: ${playerName}`);
            await logPlayerActivity(playerName, 'joined', null, serverKey, server);
            
        } else if (!serverPlayerStates[serverKey][playerName].isOnline) {
            // Player rejoined
            serverPlayerStates[serverKey][playerName].joinTime = currentTime;
            serverPlayerStates[serverKey][playerName].isOnline = true;
            
            console.log(`🔄 [${server.name}] Player rejoined: ${playerName}`);
            await logPlayerActivity(playerName, 'joined', null, serverKey, server);
        }
    }
    
    // Detect leaves
    for (const playerName of previousPlayers) {
        if (serverPlayerStates[serverKey][playerName].isOnline && !currentPlayers.includes(playerName)) {
            // Player left
            const sessionDuration = currentTime - serverPlayerStates[serverKey][playerName].joinTime;
            serverPlayerStates[serverKey][playerName].isOnline = false;
            
            console.log(`❌ [${server.name}] Player left: ${playerName} (Session: ${formatDuration(sessionDuration)})`);
            await logPlayerActivity(playerName, 'left', sessionDuration, serverKey, server);
        }
    }
}

// Log player join/leave activity to Discord
async function logPlayerActivity(playerName, action, duration = null, serverKey, server) {
    // Get appropriate channel based on server
    const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL : 
                     serverKey === 'horizon' ? HORIZON_LOG_CHANNEL :
                     serverKey === 'elyxir' ? ELYXIR_LOG_CHANNEL : 
                     GLOBAL_LOG_CHANNEL;
    
    if (!channelId) return;
    
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.error(`❌ Cannot find log channel with ID: ${channelId}`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTimestamp();
        
        if (action === 'joined') {
            embed.setColor('#00ff00')
                .setTitle('🟢 Player Joined')
                .setDescription(`**${playerName}** joined **${server.name}**`)
                .addFields(
                    { name: 'Server', value: server.name, inline: true },
                    { name: 'City', value: server.city, inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        } else if (action === 'left') {
            embed.setColor('#ff0000')
                .setTitle('🔴 Player Left')
                .setDescription(`**${playerName}** left **${server.name}**`)
                .addFields(
                    { name: 'Server', value: server.name, inline: true },
                    { name: 'Session Duration', value: formatDuration(duration), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        }
        
        await channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error logging player activity to Discord:', error);
    }
}

// Cross-server player search function
function findPlayerAcrossServers(playerName) {
    const playerData = crossServerPlayerData[playerName];
    if (!playerData) {
        return null;
    }
    
    // Find current online status across all servers
    const onlineServers = [];
    const offlineHistory = [];
    
    Object.entries(playerData.servers).forEach(([serverKey, data]) => {
        const server = SERVERS[serverKey];
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
        recentHistory: offlineHistory.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 5),
        firstSeen: playerData.firstSeen,
        lastKnownServer: playerData.lastKnownServer,
        lastKnownCity: playerData.lastKnownCity
    };
}

// Monitoring functions
function startMultiServerMonitoring() {
    console.log('🌐 Starting multi-server monitoring...');
    MONITORING_ENABLED = true;
    
    Object.keys(SERVERS).forEach(serverKey => {
        const server = SERVERS[serverKey];
        if (!server.enabled) return;
        
        // Calculate interval based on priority (higher priority = more frequent checks)
        const baseInterval = 300000; // 5 minutes
        const interval = baseInterval / server.priority;
        
        console.log(`🔄 Monitoring ${server.name} every ${interval/1000}s`);
        
        monitoringIntervals[serverKey] = setInterval(async () => {
            if (MONITORING_ENABLED) {
                try {
                    await extractPlayersFromServer(serverKey);
                    
                    // Check for tracked players
                    await checkTrackedPlayersOnServer(serverKey);
                } catch (error) {
                    console.error(`Error monitoring ${server.name}:`, error);
                }
            }
        }, interval);
        
        // Initial check
        setTimeout(() => extractPlayersFromServer(serverKey), Math.random() * 10000);
    });
}

function stopMultiServerMonitoring() {
    console.log('⏹️ Stopping multi-server monitoring...');
    MONITORING_ENABLED = false;
    
    Object.values(monitoringIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    monitoringIntervals = {};
}

// Check for tracked players across servers
async function checkTrackedPlayersOnServer(serverKey) {
    const result = await extractPlayersFromServer(serverKey);
    if (!result.players) return;
    
    const server = SERVERS[serverKey];
    
    // Check both public and private tracked players
    const allTracked = { ...trackedPlayers, ...privatelyTrackedPlayers };
    
    result.players.forEach(playerName => {
        if (allTracked[playerName.toLowerCase()]) {
            const isPrivate = privatelyTrackedPlayers[playerName.toLowerCase()];
            notifyTrackedPlayerFound(playerName, server, allTracked[playerName.toLowerCase()], isPrivate);
        }
    });
}

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
            // Send private notification to bot owner
            const owner = await client.users.fetch(process.env.BOT_OWNER_ID);
            if (owner) {
                await owner.send({ embeds: [embed] });
            }
        } else {
            // Send to appropriate log channel
            const channelId = server.name === 'Royalty RP' ? ROYALTY_LOG_CHANNEL : 
                            server.name === 'Horizon' ? HORIZON_LOG_CHANNEL :
                            server.name === 'Elyxir' ? ELYXIR_LOG_CHANNEL : 
                            GLOBAL_LOG_CHANNEL;
            
            if (channelId) {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    await channel.send({ content: '@here', embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('Error sending tracked player notification:', error);
    }
}

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('findplayer')
        .setDescription('Find a player across all monitored FiveM servers')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Player name to search for')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('serverlist')
        .setDescription('Show all monitored servers and their status'),
    
    new SlashCommandBuilder()
        .setName('addserver')
        .setDescription('Add a new server to monitor (Admin only)')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Server ID from FiveM')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Server display name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('city')
                .setDescription('City/location name')
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
        .setDescription('Start cross-server monitoring (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('stopmonitoring')
        .setDescription('Stop cross-server monitoring (Admin only)'),
    
    new SlashCommandBuilder()
        .setName('setroyalty')
        .setDescription('Set the Royalty RP logging channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for Royalty RP logs (optional - uses current if not specified)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('sethorizon')
        .setDescription('Set the Horizon logging channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for Horizon logs (optional - uses current if not specified)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('setelyxir')
        .setDescription('Set the Elyxir logging channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for Elyxir logs (optional - uses current if not specified)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('elyxir')
        .setDescription('View current players in Elyxir city')
].map(command => command.toJSON());

// Command handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'findplayer':
                await handleFindPlayer(interaction);
                break;
            case 'serverlist':
                await handleServerList(interaction);
                break;
            case 'addserver':
                await handleAddServer(interaction);
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
            case 'setroyalty':
                await handleSetRoyalty(interaction);
                break;
            case 'sethorizon':
                await handleSetHorizon(interaction);
                break;
            case 'setelyxir':
                await handleSetElyxir(interaction);
                break;
            case 'elyxir':
                await handleElyxir(interaction);
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
        await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
});

async function handleFindPlayer(interaction) {
    await interaction.deferReply();
    
    const playerName = interaction.options.getString('name');
    const playerInfo = findPlayerAcrossServers(playerName);
    
    if (!playerInfo) {
        await interaction.editReply(`❌ Player "${playerName}" not found in any monitored servers.`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🔍 Player Search Results`)
        .setDescription(`**${playerInfo.playerName}**`)
        .setTimestamp();
    
    if (playerInfo.isOnline && playerInfo.currentServers.length > 0) {
        const serverList = playerInfo.currentServers.map(s => 
            `🟢 **${s.server}** (${s.city})`
        ).join('\n');
        
        embed.addFields({
            name: '📍 Currently Online',
            value: serverList,
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
                value: `${SERVERS[playerInfo.lastKnownServer]?.name || 'Unknown'} (${playerInfo.lastKnownCity})`,
                inline: true
            });
        }
    }
    
    if (playerInfo.recentHistory.length > 0) {
        const historyList = playerInfo.recentHistory.slice(0, 3).map(h => 
            `• ${h.server} (${h.city}) - ${new Date(h.lastSeen).toLocaleString()}`
        ).join('\n');
        
        embed.addFields({
            name: '📊 Recent Activity',
            value: historyList,
            inline: false
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleServerList(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🌐 Monitored Servers')
        .setDescription('Current server monitoring status')
        .setTimestamp();
    
    const enabledServers = Object.entries(SERVERS)
        .filter(([_, server]) => server.enabled)
        .map(([key, server]) => `🟢 **${server.name}** (${server.city}) - Priority ${server.priority}`)
        .join('\n');
    
    const disabledServers = Object.entries(SERVERS)
        .filter(([_, server]) => !server.enabled)
        .map(([key, server]) => `🔴 **${server.name}** (${server.city})`)
        .join('\n');
    
    if (enabledServers) {
        embed.addFields({ name: '✅ Active Monitoring', value: enabledServers, inline: false });
    }
    
    if (disabledServers) {
        embed.addFields({ name: '⏸️ Disabled', value: disabledServers, inline: false });
    }
    
    embed.addFields({
        name: '📊 Status',
        value: `Monitoring: ${MONITORING_ENABLED ? '🟢 Active' : '🔴 Stopped'}`,
        inline: true
    });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAddServer(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    const serverId = interaction.options.getString('id');
    const serverName = interaction.options.getString('name');
    const cityName = interaction.options.getString('city');
    
    // Add server to configuration (this would require code modification in practice)
    await interaction.reply({ 
        content: `📝 To add server "${serverName}" with ID "${serverId}", please update the SERVERS configuration in the bot code.`, 
        ephemeral: true 
    });
}

async function handleTrackPlayer(interaction) {
    const playerName = interaction.options.getString('name').toLowerCase();
    const category = interaction.options.getString('category');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    trackedPlayers[playerName] = {
        category: category,
        reason: reason,
        addedBy: interaction.user.id,
        addedAt: Date.now(),
        displayName: interaction.options.getString('name')
    };
    
    saveTrackedPlayers();
    
    const categoryEmoji = category === 'enemy' ? '⚔️' : category === 'poi' ? '📍' : '🏢';
    
    await interaction.reply(`✅ Added **${interaction.options.getString('name')}** to cross-server tracking as ${categoryEmoji} ${category.toUpperCase()}`);
}

async function handleStartMonitoring(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    if (MONITORING_ENABLED) {
        await interaction.reply({ content: '⚠️ Multi-server monitoring is already running!', ephemeral: true });
        return;
    }
    
    startMultiServerMonitoring();
    await interaction.reply('✅ Started cross-server monitoring for all enabled servers!');
}

async function handleStopMonitoring(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    stopMultiServerMonitoring();
    await interaction.reply('⏹️ Stopped cross-server monitoring.');
}

async function handleSetRoyalty(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    ROYALTY_LOG_CHANNEL = channel.id;
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Royalty RP Channel Set')
        .setDescription(`Royalty RP tracking notifications will be sent to ${channel}`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    console.log(`📢 Royalty RP log channel set to: ${channel.name} (${channel.id})`);
}

async function handleSetHorizon(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    HORIZON_LOG_CHANNEL = channel.id;
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Horizon Channel Set')
        .setDescription(`Horizon tracking notifications will be sent to ${channel}`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    console.log(`📢 Horizon log channel set to: ${channel.name} (${channel.id})`);
}

async function handleSetElyxir(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ content: '❌ You need Administrator permissions to use this command.', ephemeral: true });
        return;
    }
    
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    ELYXIR_LOG_CHANNEL = channel.id;
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Elyxir Channel Set')
        .setDescription(`Elyxir tracking notifications will be sent to ${channel}`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    console.log(`📢 Elyxir log channel set to: ${channel.name} (${channel.id})`);
}

async function handleElyxir(interaction) {
    const loadingEmbed = new EmbedBuilder()
        .setColor('#ffff00')
        .setTitle('🎯 Extracting Player Names...')
        .setDescription('Getting current player list from Elyxir...\n\n*This may take 30-60 seconds*')
        .setTimestamp();
    
    await interaction.reply({ embeds: [loadingEmbed] });
    console.log(`🎮 ${interaction.user.tag} requested /elyxir command`);
    
    try {
        const results = await extractPlayersFromServer('elyxir');
        console.log(`🎮 Extraction completed for ${interaction.user.tag}:`, {
            players: results.players?.length || 0,
            error: results.error || null
        });
        
        if (results.error) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Extraction Error')
                .setDescription('Error occurred during player name extraction.')
                .addFields({ name: 'Error Details', value: results.error })
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        if (!results.players || results.players.length === 0) {
            const noPlayersEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ No Player Names Found')
                .setDescription('Elyxir server appears to be empty or inaccessible.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [noPlayersEmbed] });
        }
        
        // Success - display found players
        const cleanHostname = results.serverInfo.hostname ? 
            results.serverInfo.hostname.replace(/\^\d/g, '').replace(/\|.*$/, '').trim() : 
            'Elyxir';
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎮 Elyxir Online Players')
            .setDescription(`**${cleanHostname}**`)
            .setTimestamp();
        
        console.log(`🎮 Displaying ${results.players.length} players to ${interaction.user.tag}`);
        
        // Add player counter
        embed.addFields({
            name: '👥 Players Online',
            value: `**${results.players.length}** out of **${results.serverInfo.maxClients || 'Unknown'}** slots`,
            inline: false
        });
        
        // Create player list
        const playerList = results.players.join('\n');
        
        console.log(`🎮 Player list length: ${playerList.length} characters`);
        
        // Handle Discord's character limit
        if (playerList.length <= 1024) {
            embed.addFields({
                name: '📋 Complete Player List',
                value: playerList || 'No player names available',
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
                        value: currentChunk.trim() || 'No player names available',
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
                    value: currentChunk.trim() || 'No player names available',
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
        
        embed.setFooter({ text: `Server ID: ${SERVERS.elyxir.id} | ${results.players.length} players found` });
        
        console.log(`🎮 Sending embed with ${embed.data.fields?.length || 0} fields to ${interaction.user.tag}`);
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error during Elyxir extraction:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Unexpected Error')
            .setDescription('An unexpected error occurred while fetching Elyxir player data.')
            .addFields({ name: 'Error', value: error.message || 'Unknown error' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

// Bot ready event
client.on('ready', async () => {
    console.log(`✅ Multi-Server Tracker: ${client.user.tag} is online!`);
    console.log(`🌐 Configured to monitor ${Object.keys(SERVERS).length} servers`);
    
    // Load all data
    loadAllData();
    
    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Refreshing slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
    
    // Auto-start monitoring if channels are configured
    if (ROYALTY_LOG_CHANNEL || HORIZON_LOG_CHANNEL || ELYXIR_LOG_CHANNEL || GLOBAL_LOG_CHANNEL) {
        console.log('🚀 Auto-starting multi-server monitoring...');
        setTimeout(() => startMultiServerMonitoring(), 5000);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('💾 Saving data before shutdown...');
    savePlayerData();
    saveCrossServerData();
    saveTrackedPlayers();
    stopMultiServerMonitoring();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);