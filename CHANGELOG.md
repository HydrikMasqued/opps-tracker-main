# Changelog

All notable changes to this Discord Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - 2025-08-11

### 🚀 Major Features
- **Dual-Channel Logging System**: Separate Discord channels for Royalty RP and Horizon server logs
- **Enhanced Tracked Player Display**: Shows category, reason, and contributor for each tracked player
- **Automatic Monitoring**: Bot automatically starts monitoring when channels are configured
- **Enhanced Ping System**: @here pings for all tracked player activities with category-specific alerts

### ✨ Added
- `/setroyalty [channel]` - Set dedicated Royalty RP logging channel
- `/sethorizon [channel]` - Set dedicated Horizon server logging channel
- Detailed tracked player information display with reasons and contributors
- Auto-start monitoring when log channels are configured
- Enhanced ping alerts with category-specific messages:
  - 🚨 **ENEMY ALERT** for enemies
  - 📍 **PERSON OF INTEREST ACTIVITY** for POI
  - 🏢 **CLUB MEMBER ACTIVITY** for club members
- Separate environment variables: `ROYALTY_LOG_CHANNEL` and `HORIZON_LOG_CHANNEL`

### 🔄 Changed
- **BREAKING**: Removed single `/setchannel` command in favor of server-specific commands
- Updated `/tracked` command to show detailed information (category, reason, added by, date)
- Enhanced notification system to use appropriate channels based on server
- Updated help documentation to reflect new slash commands
- Improved console logging with server-specific channel information

### 🐛 Fixed
- Monitoring functions now use correct channel variables for notifications
- Improved error handling for dual-channel system
- Fixed channel reference issues in tracking notifications

### 📚 Documentation
- Updated `.env.example` with new dual-channel configuration
- Updated `DEPLOYMENT.md` with new command structure
- Enhanced setup instructions for dual-channel system

## [1.0.0] - 2025-08-01

### Added
- Initial release of Enhanced Player Tracker with Join Leave Logging
- Real-time FiveM server player monitoring
- Discord join/leave notifications with session duration tracking
- Player data persistence with JSON storage
- Support for multiple FiveM servers (primary/secondary)
- Automatic player rejoin detection
- Discord slash commands integration
- Configurable monitoring intervals
- Comprehensive error handling and logging
- Railway deployment configuration
- Auto-restart functionality
- Version control system with changelog

### Features
- **Player Tracking**: Monitors player joins, leaves, and session durations
- **Discord Integration**: Real-time notifications in configured Discord channel
- **Data Persistence**: Stores player tracking data between bot restarts
- **Multi-Server Support**: Can monitor multiple FiveM servers simultaneously
- **Rejoin Detection**: Identifies when players return to the server
- **Session Tracking**: Calculates and displays accurate session durations
- **Automated Monitoring**: Runs continuous monitoring with configurable intervals
- **Error Recovery**: Automatic retries and error handling for stability
- **Cloud Deployment**: Full Railway deployment support for 24/7 operation

### Technical Details
- Node.js v16+ compatible
- Discord.js v14.14.1
- Puppeteer for web scraping
- Cheerio for HTML parsing
- Axios for HTTP requests
- Environment-based configuration
- Docker containerization support

### Configuration
- Environment variables for sensitive data
- Configurable monitoring intervals
- Customizable server endpoints
- Discord channel configuration
- Debug mode support
