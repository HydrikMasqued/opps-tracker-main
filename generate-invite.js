// Bot invite link generator
const BOT_ID = '1397261295040069823'; // Your bot's application ID

// Required permissions for the bot
const permissions = [
    'ViewChannel',        // 1024
    'SendMessages',       // 2048  
    'EmbedLinks',         // 16384
    'ReadMessageHistory', // 65536
    'UseSlashCommands',   // 2147483648
    'ManageMessages'      // 8192
];

// Calculate permission integer (basic permissions)
const permissionInt = 1024 + 2048 + 16384 + 65536 + 8192; // = 93184

// Generate invite URL with applications.commands scope
const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${BOT_ID}&permissions=${permissionInt}&scope=bot%20applications.commands`;

console.log('🤖 Bot Invite Link Generator');
console.log('=' .repeat(50));
console.log(`Bot ID: ${BOT_ID}`);
console.log(`Permissions: ${permissionInt}`);
console.log('');
console.log('📎 INVITE LINK (copy this):');
console.log(inviteUrl);
console.log('');
console.log('🔧 This link includes:');
console.log('  • bot scope (required)');
console.log('  • applications.commands scope (required for slash commands)');
console.log('  • Basic permissions (view channels, send messages, embeds, etc.)');
console.log('');
console.log('📋 Instructions:');
console.log('1. Copy the invite link above');
console.log('2. Open it in your browser');
console.log('3. Select your server');
console.log('4. Make sure both "bot" and "applications.commands" are checked');
console.log('5. Authorize the bot');
console.log('6. Try typing "/" in Discord after 1-2 minutes');
