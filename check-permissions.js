require('dotenv').config();
const { REST, Routes } = require('discord.js');

async function checkSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        // Get application info
        const app = await rest.get(Routes.oauth2CurrentApplication());
        console.log(`📋 Bot Application: ${app.name} (${app.id})`);
        
        // Check current slash commands
        const commands = await rest.get(Routes.applicationCommands(app.id));
        
        console.log(`\n🔧 Registered Slash Commands (${commands.length}):`);
        commands.forEach(cmd => {
            console.log(`  • /${cmd.name} - ${cmd.description}`);
        });
        
        if (commands.length === 0) {
            console.log('\n❌ No slash commands are registered!');
            console.log('The bot needs to run once to register commands.');
        } else {
            console.log(`\n✅ ${commands.length} slash commands are properly registered.`);
            console.log('\n🔍 If you still can\'t see them in Discord:');
            console.log('1. Make sure the bot has "applications.commands" scope');
            console.log('2. Try refreshing Discord (Ctrl+R)');
            console.log('3. Check if you have Administrator permissions in the server');
            console.log('4. Try typing "/" in a channel where the bot has access');
            console.log('5. Wait a few minutes - Discord can take time to sync');
        }
        
    } catch (error) {
        console.error('❌ Error checking slash commands:', error.message);
        if (error.message.includes('401')) {
            console.log('🚨 Bot token is invalid or expired!');
        }
    }
}

checkSlashCommands();
