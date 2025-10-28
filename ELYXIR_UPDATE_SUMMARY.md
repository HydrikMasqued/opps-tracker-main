# Elyxir Update Summary

## Changes Made

### 1. Server Configuration
- **Kept**: Horizon server (brqqod) - still active
- **Added**: Elyxir server (jad794) with:
  - Server ID: `jad794`
  - Name: `Elyxir`
  - City: `Elyxir`
  - URL: `https://servers.fivem.net/servers/detail/jad794`
  - Priority: 2
  - Status: Enabled

### 2. Environment Variables Updated
**Files to update on SFTP:**

#### `.env-multiserver`
- Kept: `HORIZON_LOG_CHANNEL=1404525922530496512`
- Added: `ELYXIR_LOG_CHANNEL=` (empty, to be set via `/setelyxir`)

#### `.env.example`
- Added: `ELYXIR_LOG_CHANNEL=your_elyxir_server_discord_channel_id_here`

### 3. Code Changes in `Multi-Server-Enhanced-Tracker.js`

#### Variable Names
- Line 68: Added `HORIZON_LOG_CHANNEL` variable (kept from original)
- Line 69: Added `ELYXIR_LOG_CHANNEL` variable (new)
- Line 434: Channel routing includes both Horizon and Elyxir
- Line 912: Auto-start condition checks HORIZON_LOG_CHANNEL and ELYXIR_LOG_CHANNEL

#### New Commands Added

##### `/sethorizon` (Admin Only)
- Sets the Discord channel for Horizon tracking notifications
- Usage: `/sethorizon [channel]`
- If no channel specified, uses current channel

##### `/setelyxir` (Admin Only)
- Sets the Discord channel for Elyxir tracking notifications
- Usage: `/setelyxir [channel]`
- If no channel specified, uses current channel

##### `/elyxir`
- Displays current online players in Elyxir city
- Shows player count, server info, and complete player list
- Takes 30-60 seconds to extract data
- Handles Discord's 1024 character limit with chunking

## What to Upload to SFTP

Upload these modified files:
1. **Multi-Server-Enhanced-Tracker.js** - Main bot file with all changes
2. **.env-multiserver** - Environment config with ELYXIR_LOG_CHANNEL
3. **.env.example** - Example environment file (optional)

## Testing After Upload

1. Restart the bot
2. Run `/setelyxir` in your desired Discord channel
3. Test `/elyxir` command to verify player extraction works
4. Verify tracking notifications route to correct channel

## Key Features

- **Both Horizon and Elyxir are now active** in multi-server tracking
- Cross-server player tracking includes both servers
- Horizon monitors every 150 seconds (priority 2)
- Elyxir monitors every 150 seconds (priority 2)
- Tracked players found on either server will trigger notifications in their respective configured channels
- Total of 6 servers being monitored: Royalty RP, Horizon, NoPixel, Eclipse RP, GTA World, and Elyxir
