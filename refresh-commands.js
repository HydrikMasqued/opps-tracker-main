require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function refreshCommands() {
    try {
        console.log('🧹 Clearing all existing application commands...');
        
        // Clear all global commands first
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        console.log('✅ Cleared all global commands');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🔄 Registering new commands...');
        
        const { SlashCommandBuilder } = require('discord.js');
        
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
                        .setRequired(false))
        ].map(command => command.toJSON());
        
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        
        console.log('✅ Successfully registered all commands:');
        commands.forEach(cmd => console.log(`   - /${cmd.name}: ${cmd.description}`));
        
        console.log('\n🎉 Command refresh complete! The new commands should appear in Discord within a few minutes.');
        console.log('⚠️  If commands don\'t appear immediately, try:');
        console.log('   1. Restart Discord completely');
        console.log('   2. Wait up to 1 hour for Discord\'s cache to update');
        console.log('   3. Re-invite the bot to your server');
        
    } catch (error) {
        console.error('❌ Error refreshing commands:', error);
    }
}

refreshCommands();
