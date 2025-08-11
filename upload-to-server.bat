@echo off
echo ===========================================
echo Discord Bot SFTP Upload Script
echo ===========================================
echo.

echo IMPORTANT: Edit this file first with your server details!
echo.

REM *** EDIT THESE SETTINGS ***
set SERVER_IP=your-server-ip-here
set USERNAME=your-username-here
set REMOTE_PATH=/path/to/your/bot/

echo Server: %SERVER_IP%
echo Username: %USERNAME%
echo Remote Path: %REMOTE_PATH%
echo.

echo Files to upload:
echo - bot.js (Main bot file)
echo - install-chrome.js (Chrome installer)  
echo - .puppeteerrc.cjs (Puppeteer config)
echo - package.json (Scripts)
echo.

pause

echo Creating SFTP command file...
echo open sftp://%USERNAME%@%SERVER_IP% > sftp_commands.txt
echo cd %REMOTE_PATH% >> sftp_commands.txt
echo put "bot.js" >> sftp_commands.txt
echo put "install-chrome.js" >> sftp_commands.txt  
echo put ".puppeteerrc.cjs" >> sftp_commands.txt
echo put "package.json" >> sftp_commands.txt
echo quit >> sftp_commands.txt

echo.
echo SFTP commands created in sftp_commands.txt
echo.
echo Next steps:
echo 1. Edit this file with your server details
echo 2. Run: sftp -b sftp_commands.txt
echo 3. Enter your password when prompted
echo.

pause
