const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Error Checker for Discord Bot Project
 * Scans all JavaScript files for potential errors and inconsistencies
 */

console.log('🔍 Starting comprehensive error check...');
console.log('=' .repeat(50));

const errors = [];
const warnings = [];

// Check for permission inconsistencies
function checkPermissionIssues(filePath, content) {
    // Check for old permission format
    const oldFormatMatches = content.match(/permissions\.has\(['"]ADMINISTRATOR['"]\)/g);
    const properFormatMatches = content.match(/permissions\.has\(['"]Administrator['"]\)/g);
    const correctFormatMatches = content.match(/permissions\.has\(PermissionFlagsBits\.Administrator\)/g);
    
    if (oldFormatMatches) {
        errors.push(`${filePath}: Uses outdated permission format 'ADMINISTRATOR' (${oldFormatMatches.length} occurrences)`);
    }
    
    if (properFormatMatches) {
        warnings.push(`${filePath}: Uses string-based permissions 'Administrator' - should use PermissionFlagsBits (${properFormatMatches.length} occurrences)`);
    }
    
    if (correctFormatMatches) {
        console.log(`✅ ${filePath}: Uses correct PermissionFlagsBits format (${correctFormatMatches.length} occurrences)`);
    }
}

// Check for missing imports
function checkMissingImports(filePath, content) {
    // Check if file uses PermissionFlagsBits but doesn't import it
    if (content.includes('PermissionFlagsBits') && !content.includes('PermissionFlagsBits') && !content.includes('const {') || 
        (content.includes('PermissionFlagsBits') && !content.match(/PermissionFlagsBits.*=.*require/))) {
        
        // More precise check
        const hasImport = content.match(/const\s*{[^}]*PermissionFlagsBits[^}]*}\s*=\s*require\(['"]discord\.js['"]\)/);
        const hasUsage = content.includes('PermissionFlagsBits.Administrator');
        
        if (hasUsage && !hasImport) {
            errors.push(`${filePath}: Uses PermissionFlagsBits but doesn't import it from discord.js`);
        }
    }
    
    // Check for missing puppeteer imports
    if (content.includes('puppeteer.launch') && !content.includes("require('puppeteer')")) {
        errors.push(`${filePath}: Uses puppeteer.launch() but doesn't import puppeteer`);
    }
}

// Check for potential runtime errors
function checkRuntimeErrors(filePath, content) {
    // Check for undefined variables
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        // Check for common undefined variable patterns
        if (line.includes('browser') && line.includes('await') && line.includes('close()') && 
            !content.includes('let browser') && !content.includes('const browser')) {
            warnings.push(`${filePath}:${index + 1}: Possible undefined 'browser' variable usage`);
        }
    });
}

// Check Discord.js version compatibility
function checkDiscordJSCompatibility(filePath, content) {
    // Check for old event patterns
    if (content.includes("client.on('message'") && !content.includes("client.on('messageCreate'")) {
        errors.push(`${filePath}: Uses old Discord.js v13 'message' event - should use 'messageCreate'`);
    }
    
    // Check for old permission patterns
    if (content.includes('.hasPermission(')) {
        errors.push(`${filePath}: Uses old Discord.js .hasPermission() - should use .permissions.has()`);
    }
}

// Check for potential async/await issues
function checkAsyncIssues(filePath, content) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        // Check for missing await on common async operations
        if ((line.includes('.send(') || line.includes('.reply(')) && 
            !line.includes('await') && !line.includes('return') && 
            line.includes('interaction.')) {
            warnings.push(`${filePath}:${index + 1}: Possible missing 'await' on Discord interaction`);
        }
    });
}

// Check package.json for issues
function checkPackageJson() {
    try {
        const packagePath = path.join(__dirname, 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Check Discord.js version
            if (packageContent.dependencies && packageContent.dependencies['discord.js']) {
                const version = packageContent.dependencies['discord.js'];
                if (version.includes('^14.') || version.includes('14.')) {
                    console.log('✅ package.json: Discord.js v14 detected');
                } else {
                    warnings.push('package.json: Discord.js version may be outdated for v14 features');
                }
            }
            
            // Check main entry point
            if (packageContent.main !== 'bot.js') {
                warnings.push(`package.json: Main entry point is '${packageContent.main}', expected 'bot.js'`);
            }
        }
    } catch (error) {
        errors.push(`package.json: Error reading file - ${error.message}`);
    }
}

// Check .env file for issues
function checkEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            
            // Check for required variables
            const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
            requiredVars.forEach(varName => {
                if (!envContent.includes(`${varName}=`)) {
                    errors.push(`.env: Missing required variable '${varName}'`);
                }
            });
            
            // Check for token exposure (basic check)
            if (envContent.includes('DISCORD_TOKEN=') && !envContent.includes('YOUR_TOKEN_HERE')) {
                warnings.push('.env: Discord token is present (ensure this file is not committed to git)');
            }
            
            console.log('✅ .env: File exists and contains basic configuration');
        } else {
            errors.push('.env: File not found');
        }
    } catch (error) {
        errors.push(`.env: Error reading file - ${error.message}`);
    }
}

// Scan all JavaScript files
function scanJavaScriptFiles() {
    const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.js') && file !== 'error-check.js');
    
    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            console.log(`🔍 Checking ${file}...`);
            
            checkPermissionIssues(file, content);
            checkMissingImports(file, content);
            checkRuntimeErrors(file, content);
            checkDiscordJSCompatibility(file, content);
            checkAsyncIssues(file, content);
            
        } catch (error) {
            errors.push(`${file}: Error reading file - ${error.message}`);
        }
    });
}

// Run all checks
scanJavaScriptFiles();
checkPackageJson();
checkEnvFile();

// Report results
console.log('\n' + '='.repeat(50));
console.log('📊 ERROR CHECK RESULTS');
console.log('='.repeat(50));

if (errors.length === 0 && warnings.length === 0) {
    console.log('🎉 No errors or warnings found! Your project looks good.');
} else {
    if (errors.length > 0) {
        console.log(`❌ ERRORS FOUND (${errors.length}):`);
        errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }
    
    if (warnings.length > 0) {
        console.log(`⚠️  WARNINGS FOUND (${warnings.length}):`);
        warnings.forEach((warning, index) => {
            console.log(`   ${index + 1}. ${warning}`);
        });
    }
}

console.log('\n📝 RECOMMENDATIONS:');
if (errors.length > 0) {
    console.log('1. Fix all errors before deploying');
    console.log('2. Test the bot locally after fixes');
}
if (warnings.length > 0) {
    console.log('3. Consider addressing warnings for better compatibility');
    console.log('4. Update to Discord.js v14 best practices where possible');
}

console.log('5. Ensure .env file is not committed to version control');
console.log('6. Test all commands after deployment');

console.log('\n✅ Error check complete!');
