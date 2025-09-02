// Container deployment timestamp: 2025-08-10 17:30 UTC
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
let ROYALTY_LOG_CHANNEL_ID = process.env.ROYALTY_LOG_CHANNEL || '';
let HORIZON_LOG_CHANNEL_ID = process.env.HORIZON_LOG_CHANNEL || '';
let MONITORING_ENABLED = false;
let playerTracker = {};  // Store player join times and durations
let monitoringInterval = null;

// Safe interaction response helpers
async function safeReply(interaction, options) {
    try {
        if (interaction.deferred) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        console.error('Error sending interaction reply:', error);
        // Try to send a simple error message if possible
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
            }
        } catch (secondError) {
            console.error('Failed to send error message to user:', secondError);
        }
    }
}

async function safeDefer(interaction) {
    try {
        return await interaction.deferReply();
    } catch (error) {
        console.error('Error deferring interaction:', error);
        throw error;
    }
}

async function safeEditReply(interaction, options) {
    try {
        return await interaction.editReply(options);
    } catch (error) {
        console.error('Error editing interaction reply:', error);
        // Don't throw - just log the error
    }
}

// Permission checking function
function hasFullPatchPermission(member) {
    // Check if member exists (null when used in DMs)
    if (!member) {
        return false;
    }
    
    // Check for "Full Patch" role or Administrator permission
    const hasFullPatch = member.roles?.cache?.some(role => role.name === 'Full Patch') || false;
    const hasAdmin = member.permissions?.has(PermissionFlagsBits.Administrator) || false;
    return hasFullPatch || hasAdmin;
}

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

// Private tracking storage (hidden from regular commands)
let privateTrackedPlayers = {};
const PRIVATE_TRACKED_PLAYERS_FILE = './private_tracked_players.json';
const PRIVATE_TRACKING_OWNER = '181143017619587073'; // jayreaper's Discord ID

// Player database for name history
let playerDatabase = {};
const PLAYER_DATABASE_FILE = './player_database.json';

// ============================================================================
// COMPREHENSIVE DEBUGGING SYSTEM - OWNER ONLY
// ============================================================================

// Debug system configuration
const DEBUG_OWNER_ID = '181143017619587073'; // Your Discord ID
const ERROR_LOG_FILE = './debug_errors.json';
const DEBUG_LOG_FILE = './debug_log.json';
const MAX_ERROR_ENTRIES = 1000; // Keep last 1000 errors
const MAX_DEBUG_ENTRIES = 500;  // Keep last 500 debug entries

// Error and debug storage
let errorLog = [];
let debugLog = [];
let botStats = {
    startTime: Date.now(),
    commandsExecuted: 0,
    errorsEncountered: 0,
    lastError: null,
    monitoringCycles: 0,
    playersExtracted: 0,
    lastActivity: Date.now()
};

// Load existing error logs
function loadErrorLogs() {
    try {
        if (fs.existsSync(ERROR_LOG_FILE)) {
            const data = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
            errorLog = JSON.parse(data);
            console.log(`🐛 Loaded ${errorLog.length} error log entries`);
        }
        
        if (fs.existsSync(DEBUG_LOG_FILE)) {
            const data = fs.readFileSync(DEBUG_LOG_FILE, 'utf8');
            debugLog = JSON.parse(data);
            console.log(`🔍 Loaded ${debugLog.length} debug log entries`);
        }
    } catch (error) {
        console.error('Error loading debug logs:', error);
        errorLog = [];
        debugLog = [];
    }
}

// Save error logs
function saveErrorLogs() {
    try {
        // Keep only the most recent entries
        if (errorLog.length > MAX_ERROR_ENTRIES) {
            errorLog = errorLog.slice(-MAX_ERROR_ENTRIES);
        }
        if (debugLog.length > MAX_DEBUG_ENTRIES) {
            debugLog = debugLog.slice(-MAX_DEBUG_ENTRIES);
        }
        
        fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(errorLog, null, 2));
        fs.writeFileSync(DEBUG_LOG_FILE, JSON.stringify(debugLog, null, 2));
    } catch (error) {
        console.error('Error saving debug logs:', error);
    }
}

// Enhanced error logging function
function logError(error, context = '', severity = 'error') {
    const errorEntry = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        severity: severity,
        context: context,
        message: error.message || error,
        stack: error.stack || null,
        type: error.name || 'Unknown',
        botUptime: Date.now() - botStats.startTime
    };
    
    errorLog.push(errorEntry);
    botStats.errorsEncountered++;
    botStats.lastError = errorEntry;
    botStats.lastActivity = Date.now();
    
    // Console log with enhanced formatting
    console.error(`🐛 [${severity.toUpperCase()}] ${context}: ${error.message || error}`);
    
    // Auto-save every 10 errors
    if (errorLog.length % 10 === 0) {
        saveErrorLogs();
    }
}

// Debug logging function
function logDebug(message, data = null) {
    const debugEntry = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        message: message,
        data: data,
        botUptime: Date.now() - botStats.startTime
    };
    
    debugLog.push(debugEntry);
    botStats.lastActivity = Date.now();
    
    console.log(`🔍 [DEBUG] ${message}`);
    if (data) {
        console.log(`📊 [DATA]`, data);
    }
}

// Bot health checker
function getBotHealth() {
    const uptime = Date.now() - botStats.startTime;
    const recentErrors = errorLog.filter(e => Date.now() - e.timestamp < 3600000); // Last hour
    const memoryUsage = process.memoryUsage();
    
    return {
        uptime: uptime,
        uptimeFormatted: formatDuration(uptime),
        status: recentErrors.length > 10 ? 'UNHEALTHY' : recentErrors.length > 5 ? 'WARNING' : 'HEALTHY',
        totalErrors: errorLog.length,
        recentErrors: recentErrors.length,
        commandsExecuted: botStats.commandsExecuted,
        monitoringCycles: botStats.monitoringCycles,
        playersExtracted: botStats.playersExtracted,
        memoryUsage: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        lastActivity: botStats.lastActivity,
        monitoringEnabled: MONITORING_ENABLED,
        trackedPlayers: Object.keys(trackedPlayers).length,
        databaseSize: Object.keys(playerDatabase).length
    };
}

// Export logs to file
function exportDebugLogs() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug_export_${timestamp}.txt`;
    const health = getBotHealth();
    
    let content = '';
    content += '========================================\n';
    content += 'OOPS TRACKER BOT - DEBUG EXPORT\n';
    content += '========================================\n';
    content += `Export Date: ${new Date().toLocaleString()}\n`;
    content += `Bot Uptime: ${health.uptimeFormatted}\n`;
    content += `Bot Status: ${health.status}\n`;
    content += '\n';
    
    // Bot Health Section
    content += '========================================\n';
    content += 'BOT HEALTH & STATISTICS\n';
    content += '========================================\n';
    content += `Total Uptime: ${health.uptimeFormatted}\n`;
    content += `Health Status: ${health.status}\n`;
    content += `Commands Executed: ${health.commandsExecuted}\n`;
    content += `Monitoring Cycles: ${health.monitoringCycles}\n`;
    content += `Players Extracted: ${health.playersExtracted}\n`;
    content += `Total Errors: ${health.totalErrors}\n`;
    content += `Recent Errors (1h): ${health.recentErrors}\n`;
    content += `Memory Usage: ${health.memoryUsage.heapUsed} / ${health.memoryUsage.heapTotal}\n`;
    content += `Monitoring Enabled: ${health.monitoringEnabled}\n`;
    content += `Tracked Players: ${health.trackedPlayers}\n`;
    content += `Database Size: ${health.databaseSize} players\n`;
    content += '\n';
    
    // Recent Errors Section
    if (errorLog.length > 0) {
        content += '========================================\n';
        content += 'ERROR LOG (Last 50 entries)\n';
        content += '========================================\n';
        
        const recentErrors = errorLog.slice(-50);
        recentErrors.forEach((error, index) => {
            content += `[${error.date}] ${error.severity.toUpperCase()} - ${error.context}\n`;
            content += `  Message: ${error.message}\n`;
            content += `  Type: ${error.type}\n`;
            if (error.stack) {
                content += `  Stack: ${error.stack.split('\n')[0]}\n`;
            }
            content += `  Uptime: ${formatDuration(error.botUptime)}\n`;
            content += '\n';
        });
    }
    
    // Debug Log Section
    if (debugLog.length > 0) {
        content += '========================================\n';
        content += 'DEBUG LOG (Last 25 entries)\n';
        content += '========================================\n';
        
        const recentDebug = debugLog.slice(-25);
        recentDebug.forEach(debug => {
            content += `[${debug.date}] ${debug.message}\n`;
            if (debug.data) {
                content += `  Data: ${JSON.stringify(debug.data, null, 2).slice(0, 200)}\n`;
            }
            content += '\n';
        });
    }
    
    // System Info Section
    content += '========================================\n';
    content += 'SYSTEM INFORMATION\n';
    content += '========================================\n';
    content += `Node.js Version: ${process.version}\n`;
    content += `Platform: ${process.platform}\n`;
    content += `Architecture: ${process.arch}\n`;
    content += `Process ID: ${process.pid}\n`;
    content += `Working Directory: ${process.cwd()}\n`;
    content += '\n';
    
    // Server Configuration
    content += '========================================\n';
    content += 'SERVER CONFIGURATION\n';
    content += '========================================\n';
    content += `Royalty RP Server: ${SERVERS.royalty.id}\n`;
    content += `Horizon Server: ${SERVERS.horizon.id}\n`;
    content += `Royalty Log Channel: ${ROYALTY_LOG_CHANNEL_ID || 'Not Set'}\n`;
    content += `Horizon Log Channel: ${HORIZON_LOG_CHANNEL_ID || 'Not Set'}\n`;
    content += '\n';
    
    try {
        fs.writeFileSync(filename, content, 'utf8');
        return { filename, size: content.length };
    } catch (error) {
        logError(error, 'Export Debug Logs');
        return null;
    }
}

// Clear error logs
function clearErrorLogs() {
    const clearedCount = errorLog.length;
    errorLog = [];
    debugLog = [];
    saveErrorLogs();
    return clearedCount;
}

// Wrap existing functions with error logging
const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args);
    // Don't log our own debug messages to avoid recursion
    if (!args[0] || !args[0].toString().includes('🐛')) {
        logError(new Error(args.join(' ')), 'Console Error', 'warning');
    }
};

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

// Load private tracked players data
function loadPrivateTrackedPlayers() {
    try {
        if (fs.existsSync(PRIVATE_TRACKED_PLAYERS_FILE)) {
            const data = fs.readFileSync(PRIVATE_TRACKED_PLAYERS_FILE, 'utf8');
            privateTrackedPlayers = JSON.parse(data);
            console.log(`🕵️ Loaded ${Object.keys(privateTrackedPlayers).length} privately tracked players`);
        }
    } catch (error) {
        console.error('Error loading private tracked players:', error);
        privateTrackedPlayers = {};
    }
}

// Save private tracked players data
function savePrivateTrackedPlayers() {
    try {
        fs.writeFileSync(PRIVATE_TRACKED_PLAYERS_FILE, JSON.stringify(privateTrackedPlayers, null, 2));
    } catch (error) {
        console.error('Error saving private tracked players:', error);
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

// Add a player to private tracking (hidden from regular commands)
function addPrivateTrackedPlayer(playerName, reason = '') {
    const cleanName = playerName.trim();
    const trackingId = cleanName.toLowerCase();
    
    privateTrackedPlayers[trackingId] = {
        name: cleanName,
        addedAt: Date.now(),
        reason: reason,
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
    
    savePrivateTrackedPlayers();
    return privateTrackedPlayers[trackingId];
}

// Remove a player from private tracking
function removePrivateTrackedPlayer(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    if (privateTrackedPlayers[trackingId]) {
        delete privateTrackedPlayers[trackingId];
        savePrivateTrackedPlayers();
        return true;
    }
    return false;
}

// Check if a player is being privately tracked
function isPlayerPrivatelyTracked(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    return privateTrackedPlayers[trackingId] || null;
}

// Send private tracking notification via DM to the specified user
async function sendPrivateTrackingNotification(playerData, action, serverKey, sessionDuration = null) {
    try {
        const user = await client.users.fetch(PRIVATE_TRACKING_OWNER);
        if (!user) {
            console.log('❌ Could not find private tracking owner user');
            return;
        }
        
        const serverName = SERVERS[serverKey]?.name || serverKey;
        
        // Get total time for this player
        const tracker = serverKey === 'royalty' ? playerTracker : horizonPlayerTracker;
        const totalTime = tracker[playerData.name]?.totalTime || 0;
        
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setColor('#800080'); // Purple color for private tracking
        
        if (action === 'joined') {
            embed.setTitle(`🕵️ Private Track - Player Joined`)
                .setDescription(`**${playerData.name}** joined **${serverName}**`)
                .addFields(
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Total Time', value: formatDuration(totalTime), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
                
            if (playerData.reason) {
                embed.addFields({ name: 'Tracking Reason', value: playerData.reason, inline: false });
            }
        } else if (action === 'left') {
            const newTotalTime = totalTime + (sessionDuration || 0);
            embed.setTitle(`🕵️ Private Track - Player Left`)
                .setDescription(`**${playerData.name}** left **${serverName}**`)
                .addFields(
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'Session Duration', value: formatDuration(sessionDuration), inline: true },
                    { name: 'Total Time', value: formatDuration(newTotalTime), inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                );
        }
        
        await user.send({ embeds: [embed] });
        console.log(`🕵️ Private tracking notification sent for ${playerData.name} (${action})`);
        
    } catch (error) {
        console.error('Error sending private tracking notification:', error);
    }
}

// Send enhanced tracking notification with ping
async function sendTrackedPlayerNotification(playerData, action, serverKey, sessionDuration = null) {
    // Get appropriate channel based on server
    const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL_ID : HORIZON_LOG_CHANNEL_ID;
    if (!channelId) return;
    
    try {
        const channel = client.channels.cache.get(channelId);
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
            waitUntil: 'domcontentloaded', // Faster than networkidle0
            timeout: 30000 // Reduced timeout
        });
        
        // Reduced wait time
        await page.waitForTimeout(5000);
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
                waitUntil: 'domcontentloaded', // Faster than networkidle0
                timeout: 30000 // Reduced timeout
            });
            
            // Reduced wait time
            await page.waitForTimeout(5000);
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
                if (ROYALTY_LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'joined', null, 'royalty');
                }
            } else if (!playerTracker[player].isOnline) {
                // Player rejoined after being offline
                playerTracker[player].joinTime = currentTime;
                playerTracker[player].sessionCount += 1;
                playerTracker[player].lastSeen = currentTime;
                playerTracker[player].isOnline = true;
                
                console.log(`🔄 Player rejoined: ${player}`);
                
                // Log to Discord if channel is set
                if (ROYALTY_LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'joined', null, 'royalty');
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
                if (ROYALTY_LOG_CHANNEL_ID) {
                    logPlayerActivity(player, 'left', sessionDuration, 'royalty');
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
    // Get appropriate channel based on server
    const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL_ID : HORIZON_LOG_CHANNEL_ID;
    if (!channelId) return;
    
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.error(`❌ Cannot find log channel with ID: ${channelId}`);
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
    for (const player of currentPlayers) {
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
            const privatelyTrackedPlayer = isPlayerPrivatelyTracked(player);
            const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL_ID : HORIZON_LOG_CHANNEL_ID;
            
            if (trackedPlayer && channelId) {
                await sendTrackedPlayerNotification(trackedPlayer, 'joined', serverKey);
            } else if (channelId) {
                await logPlayerActivity(player, 'joined', null, serverKey);
            }
            
            // Send private tracking notification if player is privately tracked
            if (privatelyTrackedPlayer) {
                await sendPrivateTrackingNotification(privatelyTrackedPlayer, 'joined', serverKey);
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
            const privatelyTrackedPlayer = isPlayerPrivatelyTracked(player);
            const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL_ID : HORIZON_LOG_CHANNEL_ID;
            
            if (trackedPlayer && channelId) {
                await sendTrackedPlayerNotification(trackedPlayer, 'joined', serverKey);
            } else if (channelId) {
                await logPlayerActivity(player, 'joined', null, serverKey);
            }
            
            // Send private tracking notification if player is privately tracked
            if (privatelyTrackedPlayer) {
                await sendPrivateTrackingNotification(privatelyTrackedPlayer, 'joined', serverKey);
            }
        } else {
            // Player is still online, update last seen
            tracker[player].lastSeen = currentTime;
            tracker[player].isOnline = true;
        }
    }
    
    // Check for players who left
    for (const player of previousPlayers) {
        if (tracker[player].isOnline && !currentPlayers.includes(player)) {
            // Player left - add session time to total
            const sessionDuration = currentTime - tracker[player].joinTime;
            tracker[player].totalTime += sessionDuration;
            tracker[player].isOnline = false;
            
            console.log(`❌ [${serverName}] Player left: ${player} (Session: ${formatDuration(sessionDuration)}, Total: ${formatDuration(tracker[player].totalTime)})`);
            
            // Check if player is tracked and send notification with ping
            const trackedPlayer = isPlayerTracked(player);
            const privatelyTrackedPlayer = isPlayerPrivatelyTracked(player);
            const channelId = serverKey === 'royalty' ? ROYALTY_LOG_CHANNEL_ID : HORIZON_LOG_CHANNEL_ID;
            
            if (trackedPlayer && channelId) {
                await sendTrackedPlayerNotification(trackedPlayer, 'left', serverKey, sessionDuration);
            } else if (channelId) {
                await logPlayerActivity(player, 'left', sessionDuration, serverKey);
            }
            
            // Send private tracking notification if player is privately tracked
            if (privatelyTrackedPlayer) {
                await sendPrivateTrackingNotification(privatelyTrackedPlayer, 'left', serverKey, sessionDuration);
            }
        }
    }
}

// Start monitoring players
function startMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    MONITORING_ENABLED = true;
    console.log('🔄 Started optimized continuous monitoring (5-second intervals for maximum speed)');
    
    // Optimized continuous monitoring with minimal delays
    const runOptimizedMonitoring = async () => {
        let consecutiveErrors = 0;
        let lastSuccessfulCheck = Date.now();
        
        while (MONITORING_ENABLED) {
            const startTime = Date.now();
            
            try {
                await monitorBothServers();
                consecutiveErrors = 0;
                lastSuccessfulCheck = Date.now();
                
                // Smart delay based on performance
                const executionTime = Date.now() - startTime;
                const optimalDelay = Math.max(3000, Math.min(executionTime / 2, 8000)); // 3-8 second range
                
                console.log(`⚡ Monitoring cycle completed in ${(executionTime/1000).toFixed(1)}s, next check in ${(optimalDelay/1000).toFixed(1)}s`);
                await new Promise(resolve => setTimeout(resolve, optimalDelay));
                
            } catch (error) {
                consecutiveErrors++;
                console.error(`Error during monitoring (${consecutiveErrors} consecutive):`, error.message);
                
                // Exponential backoff for errors, but cap at 30 seconds
                const errorDelay = Math.min(5000 * Math.pow(1.5, consecutiveErrors), 30000);
                console.log(`⚠️ Waiting ${(errorDelay/1000).toFixed(1)}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, errorDelay));
            }
            
            // Safety check - if no successful checks for 5 minutes, restart monitoring
            if (Date.now() - lastSuccessfulCheck > 300000) {
                console.log('⚠️ No successful checks for 5 minutes, restarting monitoring...');
                consecutiveErrors = 0;
                lastSuccessfulCheck = Date.now();
            }
        }
    };
    
    runOptimizedMonitoring();
}

// Stop monitoring players
function stopMonitoring() {
    MONITORING_ENABLED = false;
    console.log('⏹️ Stopped continuous player monitoring');
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
        .setName('database')
        .setDescription('View all saved usernames with server information'),
    
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
        .setName('refresh')
        .setDescription('Refresh server connections and clear cached data (Admin only)')
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
    loadPrivateTrackedPlayers();
    
    // Initialize debug system
    loadErrorLogs();
    
    if (ROYALTY_LOG_CHANNEL_ID || HORIZON_LOG_CHANNEL_ID) {
        console.log(`📊 Log channels configured:`);
        if (ROYALTY_LOG_CHANNEL_ID) console.log(`   🎭 Royalty RP: ${ROYALTY_LOG_CHANNEL_ID}`);
        if (HORIZON_LOG_CHANNEL_ID) console.log(`   🌅 Horizon: ${HORIZON_LOG_CHANNEL_ID}`);
    } else {
        console.log('⚠️ No log channels configured. Use /setroyalty and /sethorizon to set them.');
    }
    
    console.log(`📍 Loaded ${Object.keys(trackedPlayers).length} tracked players`);
    
    // Log startup debug info
    logDebug('Bot started successfully', {
        trackedPlayers: Object.keys(trackedPlayers).length,
        privateTrackedPlayers: Object.keys(privateTrackedPlayers).length,
        databaseSize: Object.keys(playerDatabase).length,
        monitoringEnabled: MONITORING_ENABLED,
        logChannels: {
            royalty: ROYALTY_LOG_CHANNEL_ID || null,
            horizon: HORIZON_LOG_CHANNEL_ID || null
        }
    });
    
    // Register slash commands
    await registerSlashCommands();
    
    // Auto-start optimized monitoring
    if (ROYALTY_LOG_CHANNEL_ID || HORIZON_LOG_CHANNEL_ID) {
        console.log('🚀 Auto-starting optimized monitoring with smart intervals since log channels are configured...');
        startMonitoring();
    } else {
        console.log('⚠️ No log channels configured, but starting optimized monitoring anyway...');
        console.log('💡 Use /setroyalty and /sethorizon to set log channels for notifications.');
        startMonitoring(); // Start monitoring regardless
    }
});

// Slash command interactions handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    
    // Track command execution
    botStats.commandsExecuted++;
    botStats.lastActivity = Date.now();
    logDebug(`Slash command executed: /${commandName}`, {
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM',
        channel: interaction.channel?.name || 'Unknown'
    });

    try {
        if (commandName === 'track') {
            // Check Full Patch role or admin permissions
            if (!hasFullPatchPermission(interaction.member)) {
                return await interaction.reply({ content: '❌ You need the "Full Patch" role or Administrator permissions to use this bot.', flags: MessageFlags.Ephemeral });
            }

            const playerName = interaction.options.getString('player');
            const category = interaction.options.getString('category');
            const reason = interaction.options.getString('reason') || '';

            const existingPlayer = isPlayerTracked(playerName);
            if (existingPlayer) {
                const categoryInfo = TRACKING_CATEGORIES[existingPlayer.category];
                return await interaction.reply({ content: `❌ **${playerName}** is already being tracked as ${categoryInfo.emoji} ${categoryInfo.name}`, flags: MessageFlags.Ephemeral });
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
            // Check Full Patch role or admin permissions
            if (!hasFullPatchPermission(interaction.member)) {
                return await interaction.reply({ content: '❌ You need the "Full Patch" role or Administrator permissions to use this bot.', flags: MessageFlags.Ephemeral });
            }

            const playerName = interaction.options.getString('player');
            const existingPlayer = isPlayerTracked(playerName);

            if (!existingPlayer) {
                return await interaction.reply({ content: `❌ **${playerName}** is not currently being tracked.`, flags: MessageFlags.Ephemeral });
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
                return await interaction.reply({ content: '❌ Failed to remove player from tracking.', flags: MessageFlags.Ephemeral });
            }
        }

        else if (commandName === 'tracked') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📍 Tracked Players - Detailed List')
                .setDescription('Complete tracking information for all players')
                .setTimestamp();

            const allPlayers = Object.values(trackedPlayers);
            if (allPlayers.length === 0) {
                embed.setDescription('No players are currently being tracked.\n\nUse `/track` to start tracking players.');
                return await interaction.reply({ embeds: [embed] });
            }

            // Group players by category with detailed info
            const categories = ['enemies', 'poi', 'club']; // Enemies first for priority
            for (const categoryKey of categories) {
                const categoryPlayers = allPlayers.filter(p => p.category === categoryKey);
                if (categoryPlayers.length === 0) continue;

                const categoryInfo = TRACKING_CATEGORIES[categoryKey];
                
                // Create detailed player list with category, reason, and added by info
                const playerDetails = categoryPlayers.map(player => {
                    const addedBy = player.addedBy ? player.addedBy.split('#')[0] : 'Unknown';
                    const addedDate = new Date(player.addedAt).toLocaleDateString();
                    let detail = `**${player.name}**`;
                    if (player.reason) {
                        detail += ` - *${player.reason}*`;
                    }
                    detail += ` | Added by ${addedBy} on ${addedDate}`;
                    return detail;
                });

                const playerList = playerDetails.join('\n');

                // Handle field length limits
                if (playerList.length <= 1024) {
                    embed.addFields({
                        name: `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})`,
                        value: playerList,
                        inline: false
                    });
                } else {
                    // Split into chunks if too long
                    let currentChunk = '';
                    let chunkNumber = 1;

                    playerDetails.forEach(detail => {
                        const detailLine = detail + '\n';
                        if (currentChunk.length + detailLine.length > 900) {
                            embed.addFields({
                                name: chunkNumber === 1 ? `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})` : `${categoryInfo.name} (continued)`,
                                value: currentChunk.trim(),
                                inline: false
                            });
                            currentChunk = detailLine;
                            chunkNumber++;
                        } else {
                            currentChunk += detailLine;
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

            embed.setFooter({ text: `Total: ${allPlayers.length} tracked players | Detailed view with reasons & contributors` });
            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'find') {
            const searchPlayer = interaction.options.getString('player');
            const trackedPlayer = isPlayerTracked(searchPlayer);

            if (!trackedPlayer) {
                return await interaction.reply({ content: `❌ **${searchPlayer}** is not in the tracking list.\nUse \`/track\` to start tracking them.`, flags: MessageFlags.Ephemeral });
            }

            // Defer the interaction immediately for long-running command
            await interaction.deferReply();

            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🔍 Searching for Player...')
                .setDescription(`Looking for **${trackedPlayer.name}** on both servers...\n\n*This may take 30-60 seconds*`)
                .setTimestamp();

            await interaction.editReply({ embeds: [loadingEmbed] });

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

        else if (commandName === 'database') {
            // Check Full Patch role or admin permissions
            if (!hasFullPatchPermission(interaction.member)) {
                return await interaction.reply({ content: '❌ You need the "Full Patch" role or Administrator permissions to use this bot.', flags: MessageFlags.Ephemeral });
            }
            
            // Defer the interaction immediately for long-running command
            await interaction.deferReply();
            
            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🗃️ Generating Database File...')
                .setDescription('Creating downloadable player database file...\n\n*This may take a few seconds*')
                .setTimestamp();

            await interaction.editReply({ embeds: [loadingEmbed] });

            try {
                const allPlayers = Object.values(playerDatabase);
                if (allPlayers.length === 0) {
                    const noDataEmbed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('❌ No Database Found')
                        .setDescription('No players found in database.')
                        .setTimestamp();
                    return await interaction.editReply({ embeds: [noDataEmbed] });
                }

                // Sort players alphabetically by name
                allPlayers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

                // Calculate statistics
                const royaltyCount = allPlayers.filter(p => p.servers.includes('royalty')).length;
                const horizonCount = allPlayers.filter(p => p.servers.includes('horizon')).length;
                const bothCount = allPlayers.filter(p => p.servers.includes('royalty') && p.servers.includes('horizon')).length;
                const trackedCount = allPlayers.filter(p => isPlayerTracked(p.name)).length;

                // Generate file content
                const timestamp = new Date().toLocaleString();
                let fileContent = `# OPPS TRACKER - COMPLETE PLAYER DATABASE\n`;
                fileContent += `# Generated: ${timestamp}\n`;
                fileContent += `# Discord Bot: OPPS TRACKER\n`;
                fileContent += `# Total Players: ${allPlayers.length}\n`;
                fileContent += `#\n`;
                fileContent += `# DATABASE STATISTICS:\n`;
                fileContent += `# - Total Players: ${allPlayers.length}\n`;
                fileContent += `# - Royalty RP Only: ${royaltyCount - bothCount}\n`;
                fileContent += `# - Horizon Only: ${horizonCount - bothCount}\n`;
                fileContent += `# - Both Servers: ${bothCount}\n`;
                fileContent += `# - Currently Tracked: ${trackedCount}\n`;
                fileContent += `#\n`;
                fileContent += `# FORMAT: PlayerName [Server(s)] {TrackingStatus} | First Seen | Last Seen | Total Sightings\n`;
                fileContent += `# ========================================================================================\n\n`;

                // Add all players
                allPlayers.forEach(player => {
                    const firstSeenDate = new Date(player.firstSeen).toLocaleDateString();
                    const lastSeenDate = new Date(player.lastSeen).toLocaleDateString();
                    
                    // Format server brackets
                    let serverBrackets = '';
                    if (player.servers.includes('royalty') && player.servers.includes('horizon')) {
                        serverBrackets = '[Horizon/Royalty]';
                    } else if (player.servers.includes('horizon')) {
                        serverBrackets = '[Horizon]';
                    } else if (player.servers.includes('royalty')) {
                        serverBrackets = '[Royalty]';
                    } else {
                        const serverNames = player.servers.map(s => {
                            return s === 'royalty' ? 'Royalty' : s === 'horizon' ? 'Horizon' : s;
                        });
                        serverBrackets = `[${serverNames.join('/')}]`;
                    }

                    // Check if player is currently tracked
                    const trackedPlayer = isPlayerTracked(player.name);
                    let trackingStatus = '';
                    if (trackedPlayer) {
                        const categoryInfo = TRACKING_CATEGORIES[trackedPlayer.category];
                        trackingStatus = `{TRACKED: ${categoryInfo.name}}`;
                    } else {
                        trackingStatus = '{Not Tracked}';
                    }

                    fileContent += `${player.name} ${serverBrackets} ${trackingStatus} | First: ${firstSeenDate} | Last: ${lastSeenDate} | Sightings: ${player.totalSightings}\n`;
                });

                // Add tracking summary at the end
                fileContent += `\n\n# ========================================================================================\n`;
                fileContent += `# TRACKED PLAYERS SUMMARY\n`;
                fileContent += `# ========================================================================================\n\n`;

                const trackedPlayersList = Object.values(trackedPlayers);
                if (trackedPlayersList.length > 0) {
                    const categories = ['enemies', 'poi', 'club'];
                    for (const categoryKey of categories) {
                        const categoryPlayers = trackedPlayersList.filter(p => p.category === categoryKey);
                        if (categoryPlayers.length === 0) continue;

                        const categoryInfo = TRACKING_CATEGORIES[categoryKey];
                        fileContent += `## ${categoryInfo.emoji} ${categoryInfo.name.toUpperCase()} (${categoryPlayers.length} players)\n`;
                        fileContent += `${'-'.repeat(50)}\n`;

                        categoryPlayers.forEach(player => {
                            const addedBy = player.addedBy ? player.addedBy.split('#')[0] : 'Unknown';
                            const addedDate = new Date(player.addedAt).toLocaleDateString();
                            fileContent += `${player.name}\n`;
                            if (player.reason) {
                                fileContent += `  Reason: ${player.reason}\n`;
                            }
                            fileContent += `  Added by: ${addedBy} on ${addedDate}\n\n`;
                        });
                    }
                } else {
                    fileContent += `No players are currently being tracked.\n`;
                }

                // Write file to disk
                const fileName = `player_database_${new Date().toISOString().slice(0, 10)}.txt`;
                const filePath = `./${fileName}`;
                
                fs.writeFileSync(filePath, fileContent, 'utf8');

                // Create success embed with file info
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Database File Generated Successfully!')
                    .setDescription(`Complete player database has been exported to a text file.`)
                    .addFields(
                        { name: '💾 File Name', value: fileName, inline: true },
                        { name: '📊 Total Players', value: allPlayers.length.toString(), inline: true },
                        { name: '📝 File Size', value: `${Math.round(fileContent.length / 1024)} KB`, inline: true },
                        { name: '📁 Content Includes', value: '• Complete player list with server info\n• Player tracking status\n• First/last seen dates\n• Sighting counts\n• Detailed tracking summary', inline: false },
                        { name: '📄 File Location', value: `The file has been saved in the bot directory: \`${filePath}\``, inline: false }
                    )
                    .setFooter({ text: `Generated: ${timestamp} | ${allPlayers.length} players | ${trackedCount} tracked` })
                    .setTimestamp();

                // Send file as attachment
                try {
                    const { AttachmentBuilder } = require('discord.js');
                    const attachment = new AttachmentBuilder(filePath, { name: fileName });

                    await interaction.editReply({ 
                        embeds: [successEmbed], 
                        files: [attachment] 
                    });

                    console.log(`🗃️ Database file generated and sent: ${fileName} (${allPlayers.length} players)`);
                    
                } catch (attachError) {
                    console.error('Error sending file attachment:', attachError);
                    
                    // If attachment fails, at least send the embed with file location info
                    successEmbed.addFields({
                        name: '⚠️ File Attachment Error',
                        value: `Could not attach file to Discord message. The file has been saved locally at:\n\`${filePath}\`\n\nFile size: ${Math.round(fileContent.length / 1024)} KB`,
                        inline: false
                    });
                    
                    await interaction.editReply({ embeds: [successEmbed] });
                    console.log(`🗃️ Database file generated but attachment failed: ${fileName} (${allPlayers.length} players)`);
                }

            } catch (error) {
                console.error('Error generating database file:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Database Generation Error')
                    .setDescription('An error occurred while generating the database file.')
                    .addFields({ name: 'Error Details', value: error.message })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        else if (commandName === 'royalty') {
            // Check Full Patch role or admin permissions
            if (!hasFullPatchPermission(interaction.member)) {
                return await interaction.reply({ content: '❌ You need the "Full Patch" role or Administrator permissions to use this bot.', flags: MessageFlags.Ephemeral });
            }

            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🎯 Extracting Player Names...')
                .setDescription('Getting current player list and updating tracking data...\n\n*This may take 30-60 seconds*')
                .setTimestamp();

            await interaction.reply({ embeds: [loadingEmbed] });
            console.log(`🎮 ${interaction.user.tag} requested /royalty command`);

            try {
                const results = await extractAndTrackPlayers();
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
                        .setDescription('Server appears to be empty or inaccessible.')
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [noPlayersEmbed] });
                }

                // Success - display found players with tracking info
                const cleanHostname = results.serverInfo.hostname ? 
                    results.serverInfo.hostname.replace(/\^\d/g, '').replace(/\|.*$/, '').trim() : 
                    'Royalty RP';

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎮 Royalty RP Online Players')
                    .setDescription(`**${cleanHostname}**`)
                    .setTimestamp();

                console.log(`🎮 Displaying ${results.players.length} players to ${interaction.user.tag}`);
                console.log(`🎮 Player names: ${results.players.slice(0, 5).join(', ')}${results.players.length > 5 ? '...' : ''}`);

                // Add player counter
                embed.addFields({
                    name: '👥 Players Online',
                    value: `**${results.players.length}** out of **${results.serverInfo.maxClients || 'Unknown'}** slots`,
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

                console.log(`🎮 Player list length: ${playerList.length} characters`);

                // Handle Discord's character limit
                if (playerList.length <= 1024) {
                    embed.addFields({
                        name: '📋 Complete Player List (with session times)',
                        value: playerList || 'No player names available',
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
                            name: chunkNumber === 1 ? '📋 Player List (with times)' : '📋 Player List (continued)',
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

                embed.setFooter({ text: `Server ID: ${SERVER_ID} | Enhanced Tracking | ${results.players.length} players found` });

                console.log(`🎮 Sending embed with ${embed.data.fields?.length || 0} fields to ${interaction.user.tag}`);
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
            // Check Full Patch role or admin permissions
            if (!hasFullPatchPermission(interaction.member)) {
                return await interaction.reply({ content: '❌ You need the "Full Patch" role or Administrator permissions to use this bot.', flags: MessageFlags.Ephemeral });
            }

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to start monitoring.', flags: MessageFlags.Ephemeral });
            }

            startMonitoring();

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔄 Optimized Monitoring Started')
                .setDescription('Player tracking has been started for both Royalty RP and Horizon servers. Using intelligent 3-8 second intervals for maximum speed and accuracy.')
                .addFields(
                    { name: '⚡ Performance', value: 'Smart delays (3-8s) based on server response times', inline: true },
                    { name: '🔄 Recovery', value: 'Auto-retry with exponential backoff on errors', inline: true },
                    { name: '🎯 Accuracy', value: 'Immediate detection within seconds of player changes', inline: true }
                )
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'stopmonitor') {
            // Check admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to stop monitoring.', flags: MessageFlags.Ephemeral });
            }

            stopMonitoring();

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏹️ Monitoring Stopped')
                .setDescription('Player tracking has been stopped.')
                .setTimestamp();

            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'setroyalty') {
            // Check admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to set log channels.', flags: MessageFlags.Ephemeral });
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const channelId = channel.id;
            ROYALTY_LOG_CHANNEL_ID = channelId;

            // Update .env file
            const envContent = fs.readFileSync('.env', 'utf8');
            const newEnvContent = envContent.includes('ROYALTY_LOG_CHANNEL=')
                ? envContent.replace(/ROYALTY_LOG_CHANNEL=.*/, `ROYALTY_LOG_CHANNEL=${channelId}`)
                : envContent + `\nROYALTY_LOG_CHANNEL=${channelId}`;

            fs.writeFileSync('.env', newEnvContent);

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎭 Royalty RP Log Channel Set')
                .setDescription(`Royalty RP player activity will now be logged to \u003c#${channelId}\u003e`)
                .setTimestamp();

            console.log(`🎭 Royalty RP log channel set to: ${channelId}`);
            return await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'sethorizon') {
            // Check admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to set log channels.', flags: MessageFlags.Ephemeral });
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const channelId = channel.id;
            HORIZON_LOG_CHANNEL_ID = channelId;

            // Update .env file
            const envContent = fs.readFileSync('.env', 'utf8');
            const newEnvContent = envContent.includes('HORIZON_LOG_CHANNEL=')
                ? envContent.replace(/HORIZON_LOG_CHANNEL=.*/, `HORIZON_LOG_CHANNEL=${channelId}`)
                : envContent + `\nHORIZON_LOG_CHANNEL=${channelId}`;

            fs.writeFileSync('.env', newEnvContent);

            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('🌅 Horizon Log Channel Set')
                .setDescription(`Horizon server player activity will now be logged to \u003c#${channelId}\u003e`)
                .setTimestamp();

            console.log(`🌅 Horizon log channel set to: ${channelId}`);
            return await interaction.reply({ embeds: [embed] });
        }

        else if (commandName === 'refresh') {
            // Check admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ content: '❌ You need Administrator permissions to refresh server connections.', flags: MessageFlags.Ephemeral });
            }

            // Defer the interaction immediately for long-running command
            await interaction.deferReply();

            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🔄 Refreshing Server Connections...')
                .setDescription('Resetting connections and clearing cached data...\n\n*This may take 30-60 seconds*')
                .setTimestamp();

            await interaction.editReply({ embeds: [loadingEmbed] });
            console.log(`🔄 ${interaction.user.tag} requested /refresh command`);

            try {
                // First stop monitoring to prevent interference
                const wasMonitoringEnabled = MONITORING_ENABLED;
                if (MONITORING_ENABLED) {
                    console.log('⏹️ Stopping monitoring for refresh...');
                    stopMonitoring();
                }

                // Clear any connection-related caches or timeouts
                console.log('🧹 Clearing cached data...');
                
                // Wait a moment for any pending operations to complete
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Test both servers to verify connections are working
                console.log('🔍 Testing server connections...');
                const testResults = await Promise.allSettled([
                    extractPlayersFromServer('royalty'),
                    extractPlayersFromServer('horizon')
                ]);

                let royaltyStatus = '❌ Failed';
                let horizonStatus = '❌ Failed';
                let royaltyPlayers = 0;
                let horizonPlayers = 0;
                let errors = [];

                // Check Royalty RP results
                if (testResults[0].status === 'fulfilled' && !testResults[0].value.error) {
                    royaltyStatus = '✅ Working';
                    royaltyPlayers = testResults[0].value.players?.length || 0;
                    console.log(`✅ Royalty RP connection test successful: ${royaltyPlayers} players`);
                } else {
                    const error = testResults[0].status === 'rejected' ? testResults[0].reason.message : testResults[0].value.error;
                    errors.push(`Royalty RP: ${error}`);
                    console.log(`❌ Royalty RP connection test failed: ${error}`);
                }

                // Check Horizon results
                if (testResults[1].status === 'fulfilled' && !testResults[1].value.error) {
                    horizonStatus = '✅ Working';
                    horizonPlayers = testResults[1].value.players?.length || 0;
                    console.log(`✅ Horizon connection test successful: ${horizonPlayers} players`);
                } else {
                    const error = testResults[1].status === 'rejected' ? testResults[1].reason.message : testResults[1].value.error;
                    errors.push(`Horizon: ${error}`);
                    console.log(`❌ Horizon connection test failed: ${error}`);
                }

                // Restart monitoring if it was previously enabled
                if (wasMonitoringEnabled) {
                    console.log('🚀 Restarting monitoring...');
                    startMonitoring();
                }

                // Create success/status embed
                const embed = new EmbedBuilder()
                    .setTimestamp();

                const successfulConnections = (royaltyStatus.includes('✅') ? 1 : 0) + (horizonStatus.includes('✅') ? 1 : 0);

                if (successfulConnections === 2) {
                    embed.setColor('#00ff00')
                        .setTitle('✅ Server Connections Refreshed Successfully')
                        .setDescription('All server connections have been refreshed and are working properly.');
                } else if (successfulConnections === 1) {
                    embed.setColor('#ffaa00')
                        .setTitle('⚠️ Partial Refresh Success')
                        .setDescription('Some server connections are working, but there are issues with others.');
                } else {
                    embed.setColor('#ff0000')
                        .setTitle('❌ Refresh Issues Detected')
                        .setDescription('Server connections have been reset, but there are still issues. This may be temporary.');
                }

                // Add server status fields
                embed.addFields(
                    { name: '🎭 Royalty RP Status', value: `${royaltyStatus}${royaltyPlayers > 0 ? ` (${royaltyPlayers} players)` : ''}`, inline: true },
                    { name: '🌅 Horizon Status', value: `${horizonStatus}${horizonPlayers > 0 ? ` (${horizonPlayers} players)` : ''}`, inline: true },
                    { name: '🔄 Monitoring Status', value: MONITORING_ENABLED ? '🟢 Active' : '🔴 Stopped', inline: true }
                );

                // Add refresh actions performed
                embed.addFields({
                    name: '🛠️ Actions Performed',
                    value: `• ${wasMonitoringEnabled ? 'Stopped and restarted' : 'Verified'} monitoring process\n• Cleared connection caches\n• Reset network timeouts\n• Tested server connectivity\n• Refreshed extraction functions`,
                    inline: false
                });

                // Add error details if any
                if (errors.length > 0) {
                    embed.addFields({
                        name: '⚠️ Connection Issues',
                        value: errors.join('\n'),
                        inline: false
                    });
                }

                // Add recommendations
                let recommendations = [];
                if (errors.length > 0) {
                    recommendations.push('• Try using the commands again in a few minutes');
                    recommendations.push('• Check if the game servers are online');
                    recommendations.push('• Network issues may be temporary');
                }
                if (!MONITORING_ENABLED && wasMonitoringEnabled) {
                    recommendations.push('• Monitoring was restarted automatically');
                }
                if (recommendations.length === 0) {
                    recommendations.push('• /royalty and /horizon commands should work normally now');
                    recommendations.push('• Monitoring is running optimally');
                }

                if (recommendations.length > 0) {
                    embed.addFields({
                        name: '💡 Next Steps',
                        value: recommendations.join('\n'),
                        inline: false
                    });
                }

                embed.setFooter({ text: `Refresh completed | ${successfulConnections}/2 servers working` });

                console.log(`🔄 Refresh completed for ${interaction.user.tag}: ${successfulConnections}/2 servers working`);
                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Error during refresh:', error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Refresh Error')
                    .setDescription('An unexpected error occurred while refreshing server connections.')
                    .addFields({ name: 'Error Details', value: error.message })
                    .addFields({ name: '💡 Suggestion', value: 'Try again in a few minutes, or contact an administrator if the issue persists.', inline: false })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }


    } catch (error) {
        console.error('Error handling slash command:', error);
        
        const errorMessage = { content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral };
        
        if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.on('messageCreate', async (message) => {
    // UNIVERSAL MESSAGE LOGGING - LOG ALL MESSAGES FOR DEBUGGING
    console.log('🔥 [UNIVERSAL DEBUG] ANY MESSAGE RECEIVED:');
    console.log(`   👤 Author: ${message.author.tag} (${message.author.id})`);
    console.log(`   🤖 Is Bot: ${message.author.bot}`);
    console.log(`   💬 Content: "${message.content}"`);
    console.log(`   📍 Channel Type: ${message.channel.type} (1=DM, 0=Text)`);
    console.log(`   🏠 Guild: ${message.guild?.name || 'DM/No Guild'}`);
    console.log(`   ⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`   🎯 Expected Owner ID: ${PRIVATE_TRACKING_OWNER}`);
    console.log(`   🔧 Expected Debug ID: ${DEBUG_OWNER_ID}`);
    console.log(`   ✅ ID Match Check: ${message.author.id === PRIVATE_TRACKING_OWNER}`);
    
    if (message.author.bot) {
        console.log('❌ [UNIVERSAL DEBUG] Ignoring bot message');
        return;
    }
    
    const content = message.content.trim();
    botStats.lastActivity = Date.now();
    
    // COMPREHENSIVE DEBUG LOGGING FOR OWNER INTERACTIONS
    if (message.author.id === PRIVATE_TRACKING_OWNER || message.author.id === DEBUG_OWNER_ID) {
        console.log('🔍 [OWNER DEBUG] Message received from owner:');
        console.log(`   📱 User: ${message.author.tag} (${message.author.id})`);
        console.log(`   💬 Content: "${content}"`);
        console.log(`   📍 Channel: ${message.channel.type === 1 ? 'DM' : message.channel.name || 'Unknown'}`);
        console.log(`   🏠 Guild: ${message.guild?.name || 'DM'}`);
        console.log(`   🎯 Matches Private Owner: ${message.author.id === PRIVATE_TRACKING_OWNER}`);
        console.log(`   🔧 Matches Debug Owner: ${message.author.id === DEBUG_OWNER_ID}`);
        console.log(`   ⏰ Timestamp: ${new Date().toISOString()}`);
        console.log('   🔍 Command Analysis:');
        console.log(`      - Starts with !privatetrack: ${content.startsWith('!privatetrack')}`);
        console.log(`      - Starts with !privatetracklist: ${content.startsWith('!privatetracklist')}`);
        console.log(`      - Starts with !privatetracklog: ${content.startsWith('!privatetracklog')}`);
        console.log(`      - Starts with !unprivatetrack: ${content.startsWith('!unprivatetrack')}`);
        console.log(`      - Starts with !debug: ${content.startsWith('!debug')}`);
        console.log(`      - Starts with !restart: ${content.startsWith('!restart')}`);
    }
    
    // Handle owner-only debug commands
    if (content.startsWith('!debug') || content.startsWith('!errors') || content.startsWith('!exportlogs') || content.startsWith('!clearerrors') || content.startsWith('!debugstatus')) {
        // Only allow the owner to use debug commands
        if (message.author.id !== DEBUG_OWNER_ID) {
            return message.react('❌'); // Just react with X for non-owners
        }
        
        try {
            if (content.startsWith('!debug')) {
                const args = content.split(' ').slice(1);
                const debugMessage = args.length > 0 ? args.join(' ') : 'Manual debug command executed';
                
                // Log debug entry
                logDebug(`Manual Debug Command: ${debugMessage}`, {
                    user: message.author.tag,
                    channel: message.channel.name || 'DM',
                    guild: message.guild?.name || 'DM'
                });
                
                const embed = new EmbedBuilder()
                    .setColor('#00ffff')
                    .setTitle('🔍 Debug Command Executed')
                    .setDescription(`Debug message logged successfully`)
                    .addFields(
                        { name: 'Message', value: debugMessage, inline: false },
                        { name: 'Logged At', value: new Date().toLocaleString(), inline: true },
                        { name: 'Bot Uptime', value: formatDuration(Date.now() - botStats.startTime), inline: true }
                    )
                    .setTimestamp();
                
                message.react('🔍');
                return message.reply({ embeds: [embed] });
            }
            
            else if (content.startsWith('!errors')) {
                const recentErrors = errorLog.slice(-10); // Last 10 errors
                
                if (recentErrors.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ No Recent Errors')
                        .setDescription('No errors have been logged recently.')
                        .addFields({
                            name: 'Bot Health',
                            value: `Uptime: ${formatDuration(Date.now() - botStats.startTime)}\nTotal Errors: ${errorLog.length}`,
                            inline: false
                        })
                        .setTimestamp();
                    
                    message.react('✅');
                    return message.reply({ embeds: [embed] });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle(`🐛 Recent Errors (Last ${recentErrors.length})`)
                    .setDescription(`Showing the most recent errors from the error log:`)
                    .setTimestamp();
                
                recentErrors.forEach((error, index) => {
                    const timeAgo = Date.now() - error.timestamp;
                    const timeAgoText = timeAgo < 60000 ? `${Math.floor(timeAgo/1000)}s ago` :
                                       timeAgo < 3600000 ? `${Math.floor(timeAgo/60000)}m ago` :
                                       `${Math.floor(timeAgo/3600000)}h ago`;
                    
                    embed.addFields({
                        name: `${index + 1}. ${error.severity.toUpperCase()} - ${error.context || 'Unknown'}`,
                        value: `**Message:** ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}\n**Time:** ${timeAgoText} (${new Date(error.timestamp).toLocaleString()})\n**Type:** ${error.type}`,
                        inline: false
                    });
                });
                
                embed.setFooter({ text: `Total errors logged: ${errorLog.length} | Use !exportlogs for full details` });
                
                message.react('🐛');
                return message.reply({ embeds: [embed] });
            }
            
            else if (content.startsWith('!exportlogs')) {
                message.react('📤');
                
                const loadingEmbed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('📤 Exporting Debug Logs...')
                    .setDescription('Generating comprehensive debug export file...')
                    .setTimestamp();
                
                const loadingMsg = await message.reply({ embeds: [loadingEmbed] });
                
                try {
                    const exportResult = exportDebugLogs();
                    
                    if (!exportResult) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('❌ Export Failed')
                            .setDescription('Failed to generate debug export file.')
                            .setTimestamp();
                        
                        return loadingMsg.edit({ embeds: [errorEmbed] });
                    }
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ Debug Logs Exported Successfully')
                        .setDescription('Comprehensive debug information has been exported to a text file.')
                        .addFields(
                            { name: '📁 Filename', value: exportResult.filename, inline: true },
                            { name: '📊 File Size', value: `${Math.round(exportResult.size / 1024)} KB`, inline: true },
                            { name: '🐛 Error Entries', value: errorLog.length.toString(), inline: true },
                            { name: '🔍 Debug Entries', value: debugLog.length.toString(), inline: true },
                            { name: '📋 Contents Include', value: '• Bot health & statistics\n• Recent error log (50 entries)\n• Debug log (25 entries)\n• System information\n• Server configuration', inline: false }
                        )
                        .setTimestamp();
                    
                    // Try to send as attachment
                    try {
                        const { AttachmentBuilder } = require('discord.js');
                        const attachment = new AttachmentBuilder(exportResult.filename, { name: exportResult.filename });
                        
                        await loadingMsg.edit({ 
                            embeds: [successEmbed], 
                            files: [attachment] 
                        });
                        
                        console.log(`📤 Debug logs exported and sent to owner: ${exportResult.filename}`);
                        
                    } catch (attachError) {
                        console.error('Error sending debug file attachment:', attachError);
                        
                        successEmbed.addFields({
                            name: '⚠️ File Location',
                            value: `File saved locally: \`${exportResult.filename}\`\n\nCould not attach to Discord message due to size or other limitations.`,
                            inline: false
                        });
                        
                        await loadingMsg.edit({ embeds: [successEmbed] });
                    }
                    
                } catch (exportError) {
                    console.error('Error during debug export:', exportError);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Export Error')
                        .setDescription('An error occurred while generating the debug export.')
                        .addFields({ name: 'Error', value: exportError.message })
                        .setTimestamp();
                    
                    await loadingMsg.edit({ embeds: [errorEmbed] });
                }
            }
            
            else if (content.startsWith('!clearerrors')) {
                const clearedCount = clearErrorLogs();
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🧹 Error Logs Cleared')
                    .setDescription(`Successfully cleared all error and debug logs.`)
                    .addFields(
                        { name: 'Cleared Entries', value: `${clearedCount} error entries removed`, inline: true },
                        { name: 'Debug Entries', value: `${debugLog.length} debug entries removed`, inline: true },
                        { name: 'Cleared At', value: new Date().toLocaleString(), inline: true }
                    )
                    .addFields({
                        name: '🔄 Fresh Start',
                        value: 'Error and debug logs have been reset. New entries will be logged from this point forward.',
                        inline: false
                    })
                    .setTimestamp();
                
                console.log(`🧹 Debug logs cleared by owner (${clearedCount} entries removed)`);
                message.react('🧹');
                return message.reply({ embeds: [embed] });
            }
            
            else if (content.startsWith('!debugstatus')) {
                const health = getBotHealth();
                
                const statusColor = health.status === 'HEALTHY' ? '#00ff00' : 
                                  health.status === 'WARNING' ? '#ffaa00' : '#ff0000';
                
                const embed = new EmbedBuilder()
                    .setColor(statusColor)
                    .setTitle(`🏥 Bot Health Status: ${health.status}`)
                    .setDescription('Comprehensive bot health and performance metrics')
                    .addFields(
                        { name: '⏱️ Uptime', value: health.uptimeFormatted, inline: true },
                        { name: '🎯 Commands Executed', value: health.commandsExecuted.toString(), inline: true },
                        { name: '🔄 Monitoring Cycles', value: health.monitoringCycles.toString(), inline: true },
                        { name: '👥 Players Extracted', value: health.playersExtracted.toString(), inline: true },
                        { name: '📊 Total Errors', value: health.totalErrors.toString(), inline: true },
                        { name: '⚠️ Recent Errors (1h)', value: health.recentErrors.toString(), inline: true },
                        { name: '💾 Memory Usage', value: `${health.memoryUsage.heapUsed} / ${health.memoryUsage.heapTotal}\n(RSS: ${health.memoryUsage.rss})`, inline: true },
                        { name: '🔄 Monitoring Status', value: health.monitoringEnabled ? '🟢 Active' : '🔴 Inactive', inline: true },
                        { name: '📍 Tracked Players', value: health.trackedPlayers.toString(), inline: true },
                        { name: '🗃️ Database Size', value: `${health.databaseSize} players`, inline: true },
                        { name: '📱 Last Activity', value: new Date(health.lastActivity).toLocaleString(), inline: true },
                        { name: '🌐 Bot Status', value: client.ws.status === 0 ? '🟢 Connected' : '🔴 Disconnected', inline: true }
                    );
                
                if (health.recentErrors > 0) {
                    embed.addFields({
                        name: '⚠️ Health Recommendations',
                        value: health.recentErrors > 10 ? '• Bot is experiencing significant issues\n• Consider restarting the bot\n• Check server connectivity' :
                               health.recentErrors > 5 ? '• Some errors detected\n• Monitor for recurring issues\n• Check error log with !errors' :
                               '• Minor errors detected\n• Normal operation expected',
                        inline: false
                    });
                }
                
                embed.setFooter({ text: `Debug System v1.0 | ${new Date().toLocaleString()}` })
                     .setTimestamp();
                
                console.log(`🏥 Debug status requested by owner - Status: ${health.status}`);
                message.react('🏥');
                return message.reply({ embeds: [embed] });
            }
            
        } catch (debugError) {
            console.error('Error in debug command:', debugError);
            logError(debugError, 'Debug Command Error');
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Debug Command Error')
                .setDescription('An error occurred while executing the debug command.')
                .addFields({ name: 'Error', value: debugError.message })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        return; // Exit early for debug commands
    }
    
    // Handle private tracking commands (owner only)
    if (content.startsWith('!privatetrack') || content.startsWith('!unprivatetrack') || content.startsWith('!privatetracklist') || content.startsWith('!restart')) {
        // Only allow the specific user to use these commands
        if (message.author.id !== PRIVATE_TRACKING_OWNER) {
            return message.react('❌'); // Just react with X for non-owners
        }
        
        if (content.startsWith('!privatetracklist')) {
            try {
                const privatelyTrackedCount = Object.keys(privateTrackedPlayers).length;
                
                if (privatelyTrackedCount === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#800080')
                        .setTitle('🕵️ Private Tracking List')
                        .setDescription('No players are currently being privately tracked.')
                        .addFields({ 
                            name: '💡 Add Private Tracking', 
                            value: 'Use `!privatetrack <PlayerName> [reason]` to start tracking a player privately.', 
                            inline: false 
                        })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [embed] });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🕵️ Private Tracking List')
                    .setDescription(`Currently tracking **${privatelyTrackedCount}** player${privatelyTrackedCount !== 1 ? 's' : ''} privately`);
                
                const playerEntries = [];
                for (const [playerId, player] of Object.entries(privateTrackedPlayers)) {
                    const addedDate = new Date(player.addedAt).toLocaleDateString();
                    const reason = player.reason ? ` (${player.reason})` : '';
                    playerEntries.push(`• **${player.name}** - Added ${addedDate}${reason}`);
                }
                
                // Split into chunks if too many players
                const chunkSize = 10;
                const chunks = [];
                for (let i = 0; i < playerEntries.length; i += chunkSize) {
                    chunks.push(playerEntries.slice(i, i + chunkSize));
                }
                
                if (chunks.length === 1) {
                    embed.addFields({ 
                        name: 'Privately Tracked Players', 
                        value: chunks[0].join('\n'), 
                        inline: false 
                    });
                } else {
                    chunks.forEach((chunk, index) => {
                        embed.addFields({
                            name: index === 0 ? 'Privately Tracked Players' : '\u200b', // Invisible character for continuation
                            value: chunk.join('\n'),
                            inline: false
                        });
                    });
                }
                
                embed.addFields(
                    { name: 'Servers Monitored', value: 'Royalty RP & Horizon', inline: true },
                    { name: 'Notification Method', value: 'Direct Messages Only', inline: true },
                    { name: '⚠️ Privacy Notice', value: 'This list is private and only visible to you. Use `!unprivatetrack <PlayerName>` to remove players.', inline: false }
                );
                
                embed.setTimestamp();
                
                console.log(`🕵️ Private tracking list requested by owner`);
                message.react('✅');
                return message.reply({ embeds: [embed] });
                
            } catch (error) {
                console.error('Error in !privatetracklist command:', error);
                return message.reply('❌ An error occurred while fetching the private tracking list.');
            }
        }
        
        else if (content.startsWith('!privatetracklog')) {
            // Show private tracking statistics log
            try {
                let output = '';
                const totalPrivatelyTracked = Object.keys(privateTrackedPlayers).length;

                if (totalPrivatelyTracked === 0) {
                    return message.reply('🕵️ You are not currently privately tracking any players.');
                }

                output += `🕵️ Private Tracking Log for ${totalPrivatelyTracked} player${totalPrivatelyTracked !== 1 ? 's' : ''}:\n\n`;

                for (const playerId in privateTrackedPlayers) {
                    const player = privateTrackedPlayers[playerId];
                    const name = player.name;
                    const addedAt = new Date(player.addedAt).toLocaleString();

                    // Get tracking data (combining both servers)
                    const royaltyData = playerTracker[name] || { totalTime: 0, sessionCount: 0 };
                    const horizonData = horizonPlayerTracker[name] || { totalTime: 0, sessionCount: 0 };

                    const totalTime = royaltyData.totalTime + horizonData.totalTime;
                    const totalVisits = royaltyData.sessionCount + horizonData.sessionCount;

                    output += `• **${name}**:\n  - Added: ${addedAt}\n  - Total Time in City: ${formatDuration(totalTime)}\n  - Number of Visits: ${totalVisits}\n\n`;
                }

                if (output.length > 1900) {
                    // Split long messages into chunks for Discord
                    const chunks = [];
                    for (let i = 0; i < output.length; i += 1900) {
                        chunks.push(output.substring(i, i + 1900));
                    }
                    for (const chunk of chunks) {
                        await message.reply(chunk);
                    }
                } else {
                    await message.reply(output);
                }
            } catch (error) {
                console.error('Error in !privatetracklog command:', error);
                await message.reply('❌ An error occurred while showing private tracking log.');
            }
        }
        
        else if (content.startsWith('!privatetrack')) {
            const args = content.split(' ').slice(1);
            if (args.length === 0) {
                return message.reply('❌ **Usage:** `!privatetrack <PlayerName> [reason]`');
            }
            
            const playerName = args[0];
            const reason = args.slice(1).join(' ') || '';
            
            try {
                // Check if already privately tracked
                const existingPrivatePlayer = isPlayerPrivatelyTracked(playerName);
                if (existingPrivatePlayer) {
                    return message.reply(`❌ **${playerName}** is already being privately tracked.`);
                }
                
                // Check if already in regular tracking
                const regularTrackedPlayer = isPlayerTracked(playerName);
                if (regularTrackedPlayer) {
                    return message.reply(`❌ **${playerName}** is already being tracked in the regular system. Private tracking is for discrete monitoring only.`);
                }
                
                const privatePlayer = addPrivateTrackedPlayer(playerName, reason);
                
                const embed = new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🕵️ Player Added to Private Tracking')
                    .setDescription(`**${privatePlayer.name}** is now being privately tracked`)
                    .addFields(
                        { name: 'Notification Method', value: 'Direct Messages Only', inline: true },
                        { name: 'Servers', value: 'Royalty RP & Horizon', inline: true },
                        { name: 'Added', value: new Date().toLocaleString(), inline: true }
                    );
                
                if (reason) {
                    embed.addFields({ name: 'Reason', value: reason, inline: false });
                }
                
                embed.addFields({ 
                    name: '⚠️ Privacy Notice', 
                    value: 'This tracking is private and will not appear in any public lists or commands. You will receive DM notifications when this player joins or leaves servers.', 
                    inline: false 
                });
                
                console.log(`🕵️ Private tracking added: ${privatePlayer.name} (reason: ${reason || 'none'})`);
                message.react('✅');
                return message.reply({ embeds: [embed] });
                
            } catch (error) {
                console.error('Error in !privatetrack command:', error);
                return message.reply('❌ An error occurred while adding private tracking.');
            }
        }
        
        else if (content.startsWith('!unprivatetrack')) {
            const args = content.split(' ').slice(1);
            if (args.length === 0) {
                return message.reply('❌ **Usage:** `!unprivatetrack <PlayerName>`');
            }
            
            const playerName = args[0];
            
            try {
                // Check if player is privately tracked
                const privatePlayer = isPlayerPrivatelyTracked(playerName);
                if (!privatePlayer) {
                    return message.reply(`❌ **${playerName}** is not currently being privately tracked.`);
                }
                
                // Remove from private tracking
                const removed = removePrivateTrackedPlayer(playerName);
                if (!removed) {
                    return message.reply(`❌ Failed to remove **${playerName}** from private tracking.`);
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#800080')
                    .setTitle('🕵️ Player Removed from Private Tracking')
                    .setDescription(`**${privatePlayer.name}** is no longer being privately tracked`)
                    .addFields(
                        { name: 'Previously Tracked Since', value: new Date(privatePlayer.addedAt).toLocaleString(), inline: true },
                        { name: 'Servers', value: 'Royalty RP & Horizon', inline: true },
                        { name: 'Removed', value: new Date().toLocaleString(), inline: true }
                    );
                
                if (privatePlayer.reason) {
                    embed.addFields({ name: 'Previous Tracking Reason', value: privatePlayer.reason, inline: false });
                }
                
                embed.addFields({ 
                    name: '✅ Privacy Notice', 
                    value: 'Private tracking has been stopped for this player. You will no longer receive DM notifications for their activity.', 
                    inline: false 
                });
                
                console.log(`🕵️ Private tracking removed: ${privatePlayer.name}`);
                message.react('✅');
                return message.reply({ embeds: [embed] });
                
            } catch (error) {
                console.error('Error in !unprivatetrack command:', error);
                return message.reply('❌ An error occurred while removing private tracking.');
            }
        }
        
        
        else if (content.startsWith('!restart')) {
            try {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b35')
                    .setTitle('🔄 Bot Restart Initiated')
                    .setDescription('The bot is restarting... This may take a few moments.')
                    .addFields(
                        { name: 'Status', value: '🔄 Shutting down gracefully...', inline: true },
                        { name: 'Data Safety', value: '💾 All data will be saved', inline: true },
                        { name: 'Expected Downtime', value: '⏱️ ~10-30 seconds', inline: true }
                    )
                    .addFields({
                        name: '📋 Restart Process',
                        value: '1. Save all tracking data\n2. Stop monitoring processes\n3. Close Discord connection\n4. Restart application\n5. Reconnect to Discord\n6. Resume monitoring',
                        inline: false
                    })
                    .setTimestamp();
                
                console.log(`🔄 Bot restart initiated by owner (${message.author.tag})`);
                message.react('✅');
                await message.reply({ embeds: [embed] });
                
                // Give the message time to send before restarting
                setTimeout(async () => {
                    console.log('🔄 Beginning graceful restart...');
                    
                    // Save all data before restart
                    console.log('💾 Saving player data...');
                    savePlayerData();
                    console.log('💾 Saving tracked players...');
                    saveTrackedPlayers();
                    console.log('💾 Saving private tracked players...');
                    savePrivateTrackedPlayers();
                    console.log('💾 Saving tracking notifications...');
                    saveTrackingNotifications();
                    console.log('💾 Saving player database...');
                    savePlayerDatabase();
                    
                    // Stop monitoring
                    console.log('⏹️ Stopping monitoring...');
                    stopMonitoring();
                    
                    // Close Discord connection
                    console.log('🔌 Closing Discord connection...');
                    client.destroy();
                    
                    // Exit process - the process manager (like PM2, nodemon, or system service) should restart it
                    console.log('🔄 Exiting for restart...');
                    process.exit(0);
                }, 2000); // 2 second delay
                
            } catch (error) {
                console.error('Error in !restart command:', error);
                return message.reply('❌ An error occurred while initiating restart.');
            }
        }
        
        return; // Exit early for private tracking commands
    }
    
    // Only respond to slash command references to guide users for other commands
    if (content.toLowerCase().includes('!')) {
        // Check if user is trying to use old commands (exclude private tracking commands)
        const oldCommands = ['!track', '!untrack', '!tracked', '!find', '!search', '!players', '!horizon', '!categories', '!startmonitor', '!stopmonitor', '!setchannel', '!help'];
        const usedOldCommand = oldCommands.some(cmd => content.toLowerCase().startsWith(cmd));
        
        if (usedOldCommand) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Commands Updated!')
                .setDescription('This bot now uses **Slash Commands** only. The old `!` commands have been removed.')
                .addFields(
                    { name: '🔄 How to Use Slash Commands', value: 'Type `/` in Discord and you\'ll see all available commands with descriptions and options.', inline: false },
                    { name: '📍 Main Commands', value: '• `/track` - Add player to tracking\n• `/untrack` - Remove player from tracking\n• `/tracked` - View tracked players list\n• `/find` - Search for tracked player\n• `/search` - Search player database\n• `/players` - Show Royalty RP players\n• `/horizon` - Show Horizon players\n• `/categories` - View tracking categories', inline: false },
                    { name: '⚙️ Admin Commands', value: '• `/startmonitor` - Start monitoring\n• `/stopmonitor` - Stop monitoring\n• `/setroyalty` - Set Royalty RP log channel\n• `/sethorizon` - Set Horizon log channel', inline: false },
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
