#!/bin/bash

echo "🚨 EMERGENCY Chrome Installation for Pterodactyl Container"
echo "========================================================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to test Chrome installation
test_chrome() {
    local chrome_path="$1"
    echo "🧪 Testing Chrome at: $chrome_path"
    
    if [ -f "$chrome_path" ] && [ -x "$chrome_path" ]; then
        if timeout 10 "$chrome_path" --version >/dev/null 2>&1; then
            echo "✅ Chrome is working!"
            return 0
        else
            echo "⚠️ Chrome exists but won't run properly"
            return 1
        fi
    else
        echo "❌ Chrome not found or not executable"
        return 1
    fi
}

# Check if we have root permissions
if [ "$EUID" -ne 0 ]; then
    echo "⚠️ Warning: Running without root permissions"
    echo "Some installation methods may fail"
    echo ""
fi

# Step 1: Check for existing Chrome installations
echo "🔍 Step 1: Checking for existing Chrome installations..."
CHROME_PATHS=(
    "/usr/bin/chromium-browser"
    "/usr/bin/chromium"
    "/usr/bin/google-chrome-stable" 
    "/usr/bin/google-chrome"
    "/snap/bin/chromium"
    "/usr/local/bin/chromium"
    "/opt/google/chrome/chrome"
)

FOUND_CHROME=""
for path in "${CHROME_PATHS[@]}"; do
    if test_chrome "$path"; then
        FOUND_CHROME="$path"
        break
    fi
done

if [ -n "$FOUND_CHROME" ]; then
    echo ""
    echo "🎉 SUCCESS: Working Chrome found at: $FOUND_CHROME"
    echo ""
    echo "Setting environment variables..."
    export PUPPETEER_EXECUTABLE_PATH="$FOUND_CHROME"
    export CHROME_BIN="$FOUND_CHROME" 
    
    # Add to shell profile
    echo "export PUPPETEER_EXECUTABLE_PATH=\"$FOUND_CHROME\"" >> ~/.bashrc
    echo "export CHROME_BIN=\"$FOUND_CHROME\"" >> ~/.bashrc
    
    echo "✅ Environment variables set!"
    echo "🔄 Restart your bot to apply changes"
    echo ""
    echo "Your bot should now work without Chrome errors!"
    exit 0
fi

echo "❌ No working Chrome installation found"
echo ""

# Step 2: Try to install Chrome
echo "🔄 Step 2: Installing Chrome..."

# Update package lists first
echo "📦 Updating package lists..."
if command_exists apt-get; then
    apt-get update -y >/dev/null 2>&1 || echo "⚠️ Package update failed (continuing anyway)"
fi

# Try installing Chromium (lightweight option)
echo "🔧 Attempting to install Chromium..."
if command_exists apt-get; then
    if apt-get install -y chromium-browser >/dev/null 2>&1; then
        echo "✅ Chromium installation completed"
        
        # Test the installation
        if test_chrome "/usr/bin/chromium-browser"; then
            echo "🎉 SUCCESS: Chromium is working!"
            export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
            export CHROME_BIN="/usr/bin/chromium-browser"
            
            # Add to shell profile  
            echo "export PUPPETEER_EXECUTABLE_PATH=\"/usr/bin/chromium-browser\"" >> ~/.bashrc
            echo "export CHROME_BIN=\"/usr/bin/chromium-browser\"" >> ~/.bashrc
            
            echo "✅ Environment variables set!"
            echo "🔄 Restart your bot to apply changes"
            echo ""
            echo "Your bot should now work without Chrome errors!"
            exit 0
        fi
    fi
fi

echo "⚠️ Chromium installation failed, trying Google Chrome..."

# Try Google Chrome as fallback
if command_exists wget && command_exists apt-get; then
    echo "📦 Installing Google Chrome..."
    
    # Add Google Chrome repository
    if wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - >/dev/null 2>&1; then
        echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list 2>/dev/null
        
        if apt-get update -y >/dev/null 2>&1 && apt-get install -y google-chrome-stable >/dev/null 2>&1; then
            echo "✅ Google Chrome installation completed"
            
            # Test the installation
            if test_chrome "/usr/bin/google-chrome-stable"; then
                echo "🎉 SUCCESS: Google Chrome is working!"
                export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
                export CHROME_BIN="/usr/bin/google-chrome-stable"
                
                # Add to shell profile
                echo "export PUPPETEER_EXECUTABLE_PATH=\"/usr/bin/google-chrome-stable\"" >> ~/.bashrc
                echo "export CHROME_BIN=\"/usr/bin/google-chrome-stable\"" >> ~/.bashrc
                
                echo "✅ Environment variables set!"
                echo "🔄 Restart your bot to apply changes"
                echo ""
                echo "Your bot should now work without Chrome errors!"
                exit 0
            fi
        fi
    fi
fi

# Final fallback - manual instructions
echo ""
echo "❌ All automatic installation methods failed"
echo ""
echo "🛠️ MANUAL FIX OPTIONS:"
echo "========================"
echo ""
echo "Option 1: Ask your hosting provider to install Chromium:"
echo "   sudo apt-get update && sudo apt-get install -y chromium-browser"
echo ""
echo "Option 2: Set environment variable in Pterodactyl panel:"
echo "   Variable: PUPPETEER_EXECUTABLE_PATH"
echo "   Value: /usr/bin/chromium-browser"
echo ""
echo "Option 3: Your bot will work in API-only mode (still functional!)"
echo "   ✅ Player tracking still works"
echo "   ✅ Discord logging still works"  
echo "   ✅ All commands still work"
echo "   ⚠️ Only Chrome fallback scraping won't work"
echo ""
echo "💡 The Chrome error is NOT fatal - your bot is still working!"
