# Discord Bot Deployment Guide

This guide covers deploying the Enhanced FiveM Player Tracker Discord bot in different environments.

## Quick Start

### Local Development (Windows/Mac/Linux)
```bash
npm install
npm start
```

### Container/Cloud Deployment
```bash
npm install
node install-chrome-container.js
node bot.js
```

### Alternative Container Command
```bash
npm install
npm run container
```

## Environment Configuration

### Local Development
- Uses local `.cache/puppeteer` directory
- Downloads Chrome automatically if needed
- Minimal Chrome arguments for compatibility

### Container/Cloud Deployment
- Uses `/home/container/.cache/puppeteer` directory
- Requires environment variables:
  - `CONTAINER_ENV=true` or `NODE_ENV=production`
- Container-optimized Chrome arguments
- Supports Pterodactyl/Docker environments

## Puppeteer Configuration

The bot automatically detects the environment and configures Puppeteer accordingly:

### Windows (Local)
- Simple Chrome arguments: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`
- Cache: `./cache/puppeteer`

### Linux Container
- Full container arguments including `--single-process`, `--no-zygote`, etc.
- Cache: `/home/container/.cache/puppeteer`
- Chrome paths: Container-specific locations

## Environment Variables

### Required
- `DISCORD_TOKEN` - Your Discord bot token

### Optional
- `PLAYER_LOG_CHANNEL` - Discord channel ID for player activity logs
- `CONTAINER_ENV=true` - Force container mode
- `NODE_ENV=production` - Enable production optimizations
- `CHROME_BIN` - Custom Chrome executable path
- `PUPPETEER_EXECUTABLE_PATH` - Custom Puppeteer Chrome path

## Troubleshooting

### Chrome Issues
1. **"Could not find Chrome"**: Run `npm run container` instead of `npm start`
2. **Permission Issues**: Ensure cache directory has proper permissions
3. **Container Errors**: Set `CONTAINER_ENV=true` environment variable

### API Issues
1. **"API blocked"**: The bot automatically falls back to Puppeteer scraping
2. **No players found**: Check if the FiveM servers are online
3. **Timeout errors**: Increase timeout in code or check network connectivity

## Cloud Platform Specific

### Pterodactyl Panel
1. Set startup command to: `npm run container`
2. Ensure Node.js 16+ is available
3. Set `CONTAINER_ENV=true` in environment variables

### Docker
```dockerfile
ENV CONTAINER_ENV=true
ENV NODE_ENV=production
RUN mkdir -p /home/container/.cache/puppeteer
```

### Railway/Render/Heroku
- Set `NODE_ENV=production`
- The bot will automatically detect cloud environment

## Commands

### Player Commands
- `!players` - Show Royalty RP players with session times
- `!horizon` - Show Horizon server players  
- `!durations` - Show current session durations
- `!names` / `!list` - Same as !players

### Admin Commands
- `!setchannel [ID]` - Set logging channel
- `!startmonitor` - Start automatic monitoring
- `!stopmonitor` - Stop automatic monitoring
- `!help` - Show help message

## Features

✅ **Multi-environment support** (Windows, Linux, Containers)  
✅ **Automatic API/Puppeteer fallback**  
✅ **Real-time player tracking**  
✅ **Session duration logging**  
✅ **Join/leave notifications**  
✅ **Persistent data storage**  
✅ **5-minute monitoring intervals**  
✅ **Exact player name recording** (following accuracy requirements)

## Support

If you encounter issues:
1. Check the deployment method matches your environment
2. Verify environment variables are set correctly
3. Ensure proper Node.js version (16+)
4. Check Discord bot permissions
5. Verify FiveM server accessibility
