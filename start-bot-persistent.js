// Persistent Bot Starter with Auto-Restart
// This keeps the bot running even if it crashes

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let botProcess = null;
let restartCount = 0;
let maxRestarts = 10;
let isShuttingDown = false;

console.log('🚀 OPPS TRACKER - Persistent Bot Starter');
console.log('=========================================');
console.log('This will keep your bot running and automatically restart it if it crashes.');
console.log('Press Ctrl+C to stop the bot gracefully.\n');

function startBot() {
    if (isShuttingDown) return;
    
    console.log(`🔄 Starting bot... (Attempt ${restartCount + 1})`);
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);
    
    // Spawn the bot process
    botProcess = spawn('node', ['bot.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
    });
    
    // Log bot output
    botProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            console.log(output);
        }
    });
    
    // Log bot errors
    botProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
            console.error(`🔴 ERROR: ${error}`);
        }
    });
    
    // Handle bot exit
    botProcess.on('exit', (code, signal) => {
        if (isShuttingDown) {
            console.log('✅ Bot stopped gracefully.');
            return;
        }
        
        restartCount++;
        console.log(`\n⚠️ Bot exited with code ${code} (signal: ${signal})`);
        console.log(`📊 Restart count: ${restartCount}/${maxRestarts}`);
        
        if (restartCount >= maxRestarts) {
            console.log('❌ Maximum restart attempts reached. Stopping.');
            console.log('💡 Check the error logs above and fix any issues before restarting.');
            process.exit(1);
        }
        
        console.log('🔄 Restarting bot in 5 seconds...\n');
        setTimeout(() => {
            startBot();
        }, 5000);
    });
    
    // Handle bot startup errors
    botProcess.on('error', (error) => {
        console.error(`💥 Failed to start bot: ${error.message}`);
        if (error.code === 'ENOENT') {
            console.log('❌ Node.js not found. Make sure Node.js is installed and in your PATH.');
            process.exit(1);
        }
    });
    
    // Reset restart count on successful run (after 5 minutes)
    setTimeout(() => {
        if (!isShuttingDown && botProcess && !botProcess.killed) {
            console.log('✅ Bot has been running successfully for 5 minutes. Reset restart counter.');
            restartCount = 0;
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Handle graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    isShuttingDown = true;
    
    if (botProcess && !botProcess.killed) {
        console.log('⏹️ Stopping bot process...');
        botProcess.kill('SIGTERM');
        
        // Force kill after 10 seconds if it doesn't stop
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                console.log('🔥 Force killing bot process...');
                botProcess.kill('SIGKILL');
            }
        }, 10000);
    }
    
    setTimeout(() => {
        console.log('👋 Shutdown complete.');
        process.exit(0);
    }, 2000);
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('Unhandled Rejection');
});

// Check if required files exist
const requiredFiles = ['bot.js', '.env', 'package.json'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
    console.error('❌ Missing required files:', missingFiles.join(', '));
    console.log('💡 Make sure you have all the necessary bot files in this directory.');
    process.exit(1);
}

console.log('✅ All required files found.');
console.log('🚀 Starting persistent bot...\n');

// Start the bot
startBot();
