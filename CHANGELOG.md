# Changelog

All notable changes to this Discord Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
