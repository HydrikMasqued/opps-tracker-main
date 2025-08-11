const puppeteer = require('puppeteer');

async function testPuppeteer() {
    let browser;
    try {
        console.log('🧪 Testing Puppeteer...');
        
        // Simpler Chrome arguments for Windows
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        };

        // Let Puppeteer find Chrome automatically
        console.log('⚠️ Letting Puppeteer use bundled Chrome...');
        
        browser = await puppeteer.launch(launchOptions);
        console.log('✅ Puppeteer launched successfully!');
        
        const page = await browser.newPage();
        console.log('✅ Page created successfully!');
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Test with a simple page first
        console.log('🌐 Testing with Google...');
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });
        
        console.log('✅ Google loaded successfully!');
        let title = await page.title();
        console.log(`📄 Google title: ${title}`);
        
        // Now try FiveM with better error handling
        console.log('🌐 Now trying to navigate to FiveM server page...');
        try {
            await page.goto('https://servers.fivem.net/servers/detail/pz8m77', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            console.log('✅ FiveM page loaded successfully!');
            title = await page.title();
            console.log(`📄 FiveM page title: ${title}`);
        } catch (navError) {
            console.log(`⚠️ FiveM navigation failed: ${navError.message}`);
            // Try with less strict wait condition
            console.log('🔄 Retrying with networkidle0...');
            await page.goto('https://servers.fivem.net/servers/detail/pz8m77', { 
                waitUntil: 'networkidle0',
                timeout: 45000 
            });
            console.log('✅ FiveM page loaded with networkidle0!');
            title = await page.title();
            console.log(`📄 FiveM page title: ${title}`);
        }
        
        await browser.close();
        console.log('✅ Puppeteer test completed successfully!');
        
    } catch (error) {
        console.log(`❌ Puppeteer test failed: ${error.message}`);
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.log('Error closing browser:', e.message);
            }
        }
    }
}

testPuppeteer();
