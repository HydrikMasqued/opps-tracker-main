// Advanced Player Tracking Commands
// This file contains the Discord command handlers for the advanced tracking system

// Track player command - Interactive category selection
async function handleTrackCommand(message, args) {
    if (!message.member.permissions.has('Administrator')) {
        return message.reply('❌ You need Administrator permissions to manage tracked players.');
    }
    
    if (args.length < 2) {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎯 Track Player Command')
            .setDescription('Add a player to your tracking list with real-time notifications')
            .addFields(
                { name: 'Usage', value: '`!track <player_name> <category> [reason]`', inline: false },
                { name: 'Categories', value: '`poi` - People of Interest\n`club` - Club Members & Associates\n`enemies` - Enemies', inline: false },
                { name: 'Example', value: '`!track Ember enemies Hostile player from rival gang`', inline: false }
            )
            .setFooter({ text: 'Enhanced Player Tracking v5.0' })
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }
    
    const playerName = args[1];
    const category = args[2]?.toLowerCase();
    const reason = args.slice(3).join(' ') || '';
    
    // Validate category
    if (!TRACKING_CATEGORIES[category]) {
        const categoryEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid Category')
            .setDescription('Please choose a valid tracking category:')
            .addFields(
                { name: '📍 poi', value: 'People of Interest - Players being monitored for activity', inline: false },
                { name: '🏢 club', value: 'Club Members & Associates - Friendly players and allies', inline: false },
                { name: '⚔️ enemies', value: 'Enemies - Hostile players to watch carefully', inline: false }
            )
            .setFooter({ text: 'Use: !track <player> <category> [reason]' })
            .setTimestamp();
        
        return message.reply({ embeds: [categoryEmbed] });
    }
    
    // Check if player is already tracked
    const existingPlayer = isPlayerTracked(playerName);
    if (existingPlayer) {
        const existingCategory = TRACKING_CATEGORIES[existingPlayer.category];
        const updateEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ Player Already Tracked')
            .setDescription(`**${existingPlayer.name}** is already being tracked`)
            .addFields(
                { name: 'Current Category', value: `${existingCategory.emoji} ${existingCategory.name}`, inline: true },
                { name: 'Added By', value: existingPlayer.addedBy, inline: true },
                { name: 'Added Date', value: new Date(existingPlayer.addedAt).toLocaleDateString(), inline: true }
            );
        
        if (existingPlayer.reason) {
            updateEmbed.addFields({ name: 'Reason', value: existingPlayer.reason, inline: false });
        }
        
        updateEmbed.setFooter({ text: 'Use !untrack to remove, then !track to re-add with new category' });
        
        return message.reply({ embeds: [updateEmbed] });
    }
    
    // Add player to tracking
    const trackedPlayer = addTrackedPlayer(playerName, category, message.author.tag, reason);
    const categoryInfo = TRACKING_CATEGORIES[category];
    
    const successEmbed = new EmbedBuilder()
        .setColor(categoryInfo.color)
        .setTitle(`${categoryInfo.emoji} Player Added to Tracking`)
        .setDescription(`**${trackedPlayer.name}** is now being tracked`)
        .addFields(
            { name: 'Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
            { name: 'Added By', value: trackedPlayer.addedBy, inline: true },
            { name: 'Servers', value: 'Royalty RP + Horizon', inline: true }
        );
    
    if (reason) {
        successEmbed.addFields({ name: 'Reason', value: reason, inline: false });
    }
    
    successEmbed.addFields(
        { name: 'Notifications', value: '✅ Join alerts\n✅ Leave alerts\n✅ Session updates', inline: true },
        { name: 'What happens next?', value: 'You\'ll get pinged when this player joins either server!', inline: true }
    );
    
    successEmbed.setFooter({ text: 'Use !tracked to view all tracked players' })
        .setTimestamp();
    
    console.log(`📍 Player tracked: ${trackedPlayer.name} (${category}) by ${message.author.tag}`);
    
    return message.reply({ embeds: [successEmbed] });
}

// Untrack player command
async function handleUntrackCommand(message, args) {
    if (!message.member.permissions.has('Administrator')) {
        return message.reply('❌ You need Administrator permissions to manage tracked players.');
    }
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `!untrack <player_name>`\nExample: `!untrack Ember`');
    }
    
    const playerName = args[1];
    const trackedPlayer = isPlayerTracked(playerName);
    
    if (!trackedPlayer) {
        return message.reply(`❌ **${playerName}** is not currently being tracked.`);
    }
    
    const categoryInfo = TRACKING_CATEGORIES[trackedPlayer.category];
    const removed = removeTrackedPlayer(playerName);
    
    if (removed) {
        const successEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🗑️ Player Removed from Tracking')
            .setDescription(`**${trackedPlayer.name}** is no longer being tracked`)
            .addFields(
                { name: 'Was in Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
                { name: 'Originally Added By', value: trackedPlayer.addedBy, inline: true },
                { name: 'Tracked Since', value: new Date(trackedPlayer.addedAt).toLocaleDateString(), inline: true }
            )
            .setFooter({ text: 'Player tracking notifications stopped' })
            .setTimestamp();
        
        console.log(`🗑️ Player untracked: ${trackedPlayer.name} by ${message.author.tag}`);
        
        return message.reply({ embeds: [successEmbed] });
    } else {
        return message.reply('❌ Failed to remove player from tracking.');
    }
}

// List tracked players command
async function handleTrackedCommand(message, args) {
    const categoryFilter = args[1]?.toLowerCase();
    
    let playersToShow = Object.values(trackedPlayers);
    let title = '📍 All Tracked Players';
    let color = '#0099ff';
    
    if (categoryFilter && TRACKING_CATEGORIES[categoryFilter]) {
        playersToShow = getTrackedPlayersByCategory(categoryFilter);
        const categoryInfo = TRACKING_CATEGORIES[categoryFilter];
        title = `${categoryInfo.emoji} ${categoryInfo.name}`;
        color = categoryInfo.color;
    }
    
    if (playersToShow.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle(title)
            .setDescription(categoryFilter ? 
                `No players tracked in the **${TRACKING_CATEGORIES[categoryFilter].name}** category.` :
                'No players are currently being tracked.')
            .addFields({ name: 'Get Started', value: 'Use `!track <player> <category>` to add players to tracking', inline: false })
            .setTimestamp();
        
        return message.reply({ embeds: [emptyEmbed] });
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`Tracking **${playersToShow.length}** player${playersToShow.length !== 1 ? 's' : ''}`)
        .setTimestamp();
    
    // Group by category
    const categories = ['poi', 'club', 'enemies'];
    
    for (const categoryKey of categories) {
        const categoryPlayers = playersToShow.filter(p => p.category === categoryKey);
        if (categoryPlayers.length === 0) continue;
        
        const categoryInfo = TRACKING_CATEGORIES[categoryKey];
        const playerList = categoryPlayers.map(player => {
            const addedDate = new Date(player.addedAt).toLocaleDateString();
            let status = '';
            
            // Check online status
            if (player.sessionData.royalty.isOnline) {
                const sessionTime = Date.now() - player.sessionData.royalty.joinTime;
                status = ` 🟢 Online (Royalty - ${formatDuration(sessionTime)})`;
            } else if (player.sessionData.horizon.isOnline) {
                const sessionTime = Date.now() - player.sessionData.horizon.joinTime;
                status = ` 🟢 Online (Horizon - ${formatDuration(sessionTime)})`;
            } else {
                status = ' 🔴 Offline';
            }
            
            return `**${player.name}**${status}\n*Added: ${addedDate} by ${player.addedBy.split('#')[0]}*`;
        }).join('\n\n');
        
        embed.addFields({
            name: `${categoryInfo.emoji} ${categoryInfo.name} (${categoryPlayers.length})`,
            value: playerList.length > 1000 ? playerList.substring(0, 1000) + '...' : playerList,
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Use !track <player> <category> to add more | !untrack <player> to remove' });
    
    return message.reply({ embeds: [embed] });
}

// Show tracking categories command
async function handleCategoriesCommand(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Tracking Categories')
        .setDescription('Available categories for player tracking')
        .setTimestamp();
    
    for (const [key, category] of Object.entries(TRACKING_CATEGORIES)) {
        const trackedCount = getTrackedPlayersByCategory(key).length;
        embed.addFields({
            name: `${category.emoji} ${category.name}`,
            value: `${category.description}\n**Currently tracking: ${trackedCount} players**\nUse: \`!track <player> ${key}\``,
            inline: true
        });
    }
    
    embed.setFooter({ text: 'Use !tracked <category> to view players in a specific category' });
    
    return message.reply({ embeds: [embed] });
}

// Search for players command - Smart assistance
async function handleFindCommand(message, args) {
    if (args.length < 2) {
        return message.reply('❌ Usage: `!find <partial_name>`\nExample: `!find emb` (finds players with "emb" in their name)');
    }
    
    const searchTerm = args[1].toLowerCase();
    const loadingEmbed = new EmbedBuilder()
        .setColor('#ffff00')
        .setTitle('🔍 Searching Players...')
        .setDescription(`Looking for players matching "${searchTerm}"...`)
        .setTimestamp();
    
    const loadingMessage = await message.reply({ embeds: [loadingEmbed] });
    
    try {
        // Search both servers
        const royaltyResults = await extractPlayersFromServer('royalty');
        const horizonResults = await extractPlayersFromServer('horizon');
        
        const allPlayers = [
            ...royaltyResults.players.map(p => ({ name: p, server: 'Royalty RP' })),
            ...horizonResults.players.map(p => ({ name: p, server: 'Horizon' }))
        ];
        
        // Find matches
        const matches = allPlayers.filter(player => 
            player.name.toLowerCase().includes(searchTerm)
        );
        
        if (matches.length === 0) {
            const noResultsEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔍 No Players Found')
                .setDescription(`No players found matching "${searchTerm}"`)
                .addFields({ name: 'Try', value: '• Check spelling\n• Use partial names\n• Player might be offline', inline: false })
                .setTimestamp();
            
            return loadingMessage.edit({ embeds: [noResultsEmbed] });
        }
        
        const resultEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`🔍 Found ${matches.length} Player${matches.length !== 1 ? 's' : ''}`)
            .setDescription(`Matching "${searchTerm}":`)
            .setTimestamp();
        
        // Group by server
        const royaltyMatches = matches.filter(p => p.server === 'Royalty RP');
        const horizonMatches = matches.filter(p => p.server === 'Horizon');
        
        if (royaltyMatches.length > 0) {
            const playerList = royaltyMatches.map(p => {
                const tracked = isPlayerTracked(p.name);
                const trackingStatus = tracked ? ` ${TRACKING_CATEGORIES[tracked.category].emoji}` : '';
                return `• **${p.name}**${trackingStatus}`;
            }).join('\n');
            
            resultEmbed.addFields({
                name: '🎮 Royalty RP',
                value: playerList,
                inline: true
            });
        }
        
        if (horizonMatches.length > 0) {
            const playerList = horizonMatches.map(p => {
                const tracked = isPlayerTracked(p.name);
                const trackingStatus = tracked ? ` ${TRACKING_CATEGORIES[tracked.category].emoji}` : '';
                return `• **${p.name}**${trackingStatus}`;
            }).join('\n');
            
            resultEmbed.addFields({
                name: '🌅 Horizon',
                value: playerList,
                inline: true
            });
        }
        
        // Add quick action buttons
        if (matches.length === 1) {
            const player = matches[0];
            const tracked = isPlayerTracked(player.name);
            
            if (!tracked) {
                resultEmbed.addFields({
                    name: '⚡ Quick Actions',
                    value: `To track **${player.name}**:\n\`!track ${player.name} poi\` (Person of Interest)\n\`!track ${player.name} club\` (Club Member)\n\`!track ${player.name} enemies\` (Enemy)`,
                    inline: false
                });
            } else {
                const category = TRACKING_CATEGORIES[tracked.category];
                resultEmbed.addFields({
                    name: '📍 Already Tracked',
                    value: `**${player.name}** is tracked as ${category.emoji} ${category.name}`,
                    inline: false
                });
            }
        }
        
        resultEmbed.setFooter({ text: 'Icons: 📍 POI | 🏢 Club | ⚔️ Enemy' });
        
        return loadingMessage.edit({ embeds: [resultEmbed] });
        
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Search Error')
            .setDescription('Error occurred while searching for players')
            .addFields({ name: 'Error', value: error.message })
            .setTimestamp();
        
        return loadingMessage.edit({ embeds: [errorEmbed] });
    }
}

module.exports = {
    handleTrackCommand,
    handleUntrackCommand,
    handleTrackedCommand,
    handleCategoriesCommand,
    handleFindCommand
};
