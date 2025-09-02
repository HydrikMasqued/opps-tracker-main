// Fix Discord slash commands registration issues
// Run this script to clear and re-register all commands

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Recreate all slash commands exactly as they appear in bot.js
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
        .setDescription('Refresh server connections and clear cached data (Admin only)'),
    
    // PRIVATE TRACKING COMMAND (HIDDEN FROM HELP)
    new SlashCommandBuilder()
        .setName('privatetrack')
        .setDescription('Privately track a player (DMs only to owner)')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player name to privately track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for private tracking (optional)')
                .setRequired(false))
].map(command => command.toJSON());

async function refreshCommands() {
    if (!process.env.DISCORD_TOKEN) {
        console.error('❌ DISCORD_TOKEN not found in .env file!');
        console.log('💡 Make sure you have a .env file with DISCORD_TOKEN=your_bot_token_here');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Starting slash command registration fix...');
        console.log(`📋 Found ${commands.length} commands to register:`);
        
        commands.forEach((cmd, index) => {
            console.log(`   ${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
        console.log('\n🧹 Clearing existing commands...');
        
        // First, get the application ID by making a test call
        const application = await rest.get(Routes.oauth2CurrentApplication());
        const applicationId = application.id;
        
        console.log(`🤖 Application ID: ${applicationId}`);
        
        // Clear all existing global commands
        await rest.put(Routes.applicationCommands(applicationId), { body: [] });
        console.log('✅ Cleared all existing global commands');
        
        // Wait a moment for Discord to process the clearing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🚀 Registering new commands...');
        
        // Register the new commands
        const data = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${data.length} application (/) commands!`);
        console.log('\n📝 Registered commands:');
        data.forEach((cmd, index) => {
            console.log(`   ${index + 1}. /${cmd.name}`);
        });
        
        console.log('\n🎉 Command registration fix completed!');
        console.log('⏱️ Commands may take up to 1 hour to fully propagate globally.');
        console.log('💡 Try using /royalty and /horizon again after a few minutes.');
        
    } catch (error) {
        console.error('❌ Error during command registration:', error);
        
        if (error.code === 50001) {
            console.log('\n🔐 Permission Error Fix:');
            console.log('1. Go to Discord Developer Portal: https://discord.com/developers/applications');
            console.log(`2. Select your bot application`);
            console.log('3. Go to "Bot" section');
            console.log('4. Make sure all necessary permissions are enabled');
            console.log('5. Go to "OAuth2 > URL Generator"');
            console.log('6. Select scopes: "bot" and "applications.commands"');
            console.log('7. Select bot permissions you need');
            console.log('8. Use the generated URL to re-invite your bot');
        } else if (error.status === 401) {
            console.log('\n🔑 Authentication Error:');
            console.log('1. Check your DISCORD_TOKEN in .env file');
            console.log('2. Make sure the token is correct and not expired');
            console.log('3. Regenerate token if necessary in Discord Developer Portal');
        } else {
            console.log('\n🔍 Error Details:', {
                status: error.status,
                code: error.code,
                message: error.message
            });
        }
    }
}

// Run the fix
console.log('🔧 Discord Slash Commands Fix Tool');
console.log('===================================');
console.log('This will clear and re-register all bot commands to fix "Unknown Integration" errors.\n');

refreshCommands().then(() => {
    console.log('\n👋 Fix script completed. You can now close this window.');
}).catch(error => {
    console.error('💥 Fatal error:', error);
    console.log('\n👋 Fix script failed. Check the error details above.');
});
