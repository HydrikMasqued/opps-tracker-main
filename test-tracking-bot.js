// Test bot with integrated tracking system
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

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
const TRACKED_PLAYERS_FILE = './tracked_players.json';

// Load tracked players
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

// Save tracked players
function saveTrackedPlayers() {
    try {
        fs.writeFileSync(TRACKED_PLAYERS_FILE, JSON.stringify(trackedPlayers, null, 2));
    } catch (error) {
        console.error('Error saving tracked players:', error);
    }
}

// Add tracked player
function addTrackedPlayer(playerName, category, addedBy, reason = '') {
    const cleanName = playerName.trim();
    const trackingId = cleanName.toLowerCase();
    
    trackedPlayers[trackingId] = {
        name: cleanName,
        category: category,
        addedBy: addedBy,
        addedAt: Date.now(),
        reason: reason
    };
    
    saveTrackedPlayers();
    return trackedPlayers[trackingId];
}

// Check if tracked
function isPlayerTracked(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    return trackedPlayers[trackingId] || null;
}

// Remove tracked player
function removeTrackedPlayer(playerName) {
    const trackingId = playerName.toLowerCase().trim();
    if (trackedPlayers[trackingId]) {
        delete trackedPlayers[trackingId];
        saveTrackedPlayers();
        return true;
    }
    return false;
}

// Send test notification
async function sendTestNotification(channel, playerName, serverName, category) {
    const categoryInfo = TRACKING_CATEGORIES[category];
    
    const embed = new EmbedBuilder()
        .setColor(categoryInfo.color)
        .setTitle(`${categoryInfo.emoji} ${categoryInfo.name} - Player Joined`)
        .setDescription(`**${playerName}** joined **${serverName}**`)
        .addFields(
            { name: 'Category', value: categoryInfo.name, inline: true },
            { name: 'Server', value: serverName, inline: true },
            { name: 'Time', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp();
    
    let messageContent = '';
    if (category === 'enemies') {
        messageContent = `🚨 **ENEMY ALERT** 🚨`;
    } else if (category === 'poi') {
        messageContent = `📍 **Person of Interest Activity**`;
    }
    
    await channel.send({
        content: messageContent || undefined,
        embeds: [embed]
    });
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    loadTrackedPlayers();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    const args = message.content.split(' ');
    
    // Track command
    if (content.startsWith('!track')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need Administrator permissions to manage tracked players.');
        }
        
        if (args.length < 3) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎯 Track Player Command')
                .setDescription('Add a player to your tracking list')
                .addFields(
                    { name: 'Usage', value: '`!track <player> <category> [reason]`', inline: false },
                    { name: 'Categories', value: '`poi` - People of Interest\n`club` - Club Members\n`enemies` - Enemies', inline: false },
                    { name: 'Example', value: '`!track Ember enemies Hostile player`', inline: false }
                );
            
            return message.reply({ embeds: [helpEmbed] });
        }
        
        const playerName = args[1];
        const category = args[2].toLowerCase();
        const reason = args.slice(3).join(' ') || '';
        
        if (!TRACKING_CATEGORIES[category]) {
            return message.reply('❌ Invalid category. Use: `poi`, `club`, or `enemies`');
        }
        
        const existingPlayer = isPlayerTracked(playerName);
        if (existingPlayer) {
            return message.reply(`❌ **${playerName}** is already being tracked as ${TRACKING_CATEGORIES[existingPlayer.category].emoji} ${TRACKING_CATEGORIES[existingPlayer.category].name}`);
        }
        
        const trackedPlayer = addTrackedPlayer(playerName, category, message.author.tag, reason);
        const categoryInfo = TRACKING_CATEGORIES[category];
        
        const embed = new EmbedBuilder()
            .setColor(categoryInfo.color)
            .setTitle(`${categoryInfo.emoji} Player Added to Tracking`)
            .setDescription(`**${trackedPlayer.name}** is now being tracked`)
            .addFields(
                { name: 'Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
                { name: 'Added By', value: trackedPlayer.addedBy, inline: true }
            );
        
        if (reason) {
            embed.addFields({ name: 'Reason', value: reason, inline: false });
        }
        
        console.log(`📍 Player tracked: ${trackedPlayer.name} (${category}) by ${message.author.tag}`);
        return message.reply({ embeds: [embed] });
    }
    
    // Test notification command
    if (content.startsWith('!testping')) {
        if (args.length < 3) {
            return message.reply('Usage: `!testping <player> <category>`\nExample: `!testping Ember enemies`');
        }
        
        const playerName = args[1];
        const category = args[2].toLowerCase();
        
        if (!TRACKING_CATEGORIES[category]) {
            return message.reply('❌ Invalid category. Use: `poi`, `club`, or `enemies`');
        }
        
        await sendTestNotification(message.channel, playerName, 'Royalty RP', category);
        return message.reply('✅ Test notification sent!');
    }
    
    // View tracked players
    if (content.startsWith('!tracked')) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📍 Tracked Players')
            .setTimestamp();
        
        const allPlayers = Object.values(trackedPlayers);
        if (allPlayers.length === 0) {
            embed.setDescription('No players are currently being tracked.');
            return message.reply({ embeds: [embed] });
        }
        
        const categories = ['poi', 'club', 'enemies'];
        for (const categoryKey of categories) {
            const categoryPlayers = allPlayers.filter(p => p.category === categoryKey);
            if (categoryPlayers.length === 0) continue;
            
            const categoryInfo = TRACKING_CATEGORIES[categoryKey];
            const playerList = categoryPlayers.map(player => {
                const addedDate = new Date(player.addedAt).toLocaleDateString();
                return `**${player.name}**\n*Added: ${addedDate} by ${player.addedBy.split('#')[0]}*`;
            }).join('\n\n');
            
            embed.addFields({
                name: `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})`,
                value: playerList,
                inline: false
            });
        }
        
        return message.reply({ embeds: [embed] });
    }
    
    // Help command
    if (content === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎯 Advanced Player Tracker - Test Version')
            .setDescription('Test the tracking system')
            .addFields(
                { name: 'Tracking Commands', value: '`!track <player> <category> [reason]` - Add player\n`!tracked` - View tracked players\n`!testping <player> <category>` - Test notification', inline: false },
                { name: 'Categories', value: '📍 `poi` - People of Interest\n🏢 `club` - Club Members\n⚔️ `enemies` - Enemies', inline: false }
            )
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
