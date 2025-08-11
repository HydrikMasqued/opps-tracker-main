console.log('🚀 Starting OPPS TRACKER Bot...');
console.log('Keep this window open to keep the bot running!');
console.log('Press Ctrl+C to stop the bot.');
console.log('=' .repeat(50));

// Start the bot
require('./bot.js');

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n🛑 Bot stopped by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bot stopped');
    process.exit(0);
});
