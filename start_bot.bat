@echo off
title Larry Bot Discord Bot
color 0A

echo ===============================================
echo    Starting Larry Bot Discord Bot
echo ===============================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Display Node.js version
echo Node.js version:
node --version
echo.

:: Check for main bot file (try multiple common names)
set "BOT_FILE="
if exist "bot.js" set "BOT_FILE=bot.js"
if exist "index.js" set "BOT_FILE=index.js"
if exist "main.js" set "BOT_FILE=main.js"
if exist "app.js" set "BOT_FILE=app.js"
if exist "enhanced-tracker.js" set "BOT_FILE=enhanced-tracker.js"
if exist "Enhanced Player Tracker with Join Leave Logging.js" set "BOT_FILE=Enhanced Player Tracker with Join Leave Logging.js"

if "%BOT_FILE%"=="" (
    echo [ERROR] No main bot file found in current directory
    echo Looking for: bot.js, index.js, main.js, app.js, enhanced-tracker.js, or Enhanced Player Tracker with Join Leave Logging.js
    pause
    exit /b 1
)

echo Found main bot file: %BOT_FILE%
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json file not found
    echo Please make sure package.json is in the same folder as this batch file
    pause
    exit /b 1
)

:: Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found
    echo Please create a .env file with your Discord bot token and other settings
    echo You can copy .env.example and rename it to .env
    echo.
    if exist ".env.example" (
        echo .env.example file found. Please rename it to .env and configure it.
    )
    pause
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

:: Start the bot
echo Starting the bot...
echo.
echo ===============================================
echo Bot is now running. Press Ctrl+C to stop.
echo ===============================================
echo.

node "%BOT_FILE%"

:: Handle exit
echo.
echo ===============================================
echo Bot has stopped.
echo ===============================================
pause
