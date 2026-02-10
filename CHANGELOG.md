# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-29

### Added
- **Rich Interactions**:
  - Reactions: Add/remove emoji reactions to messages
  - Thread support: Enhanced thread context tracking and management
  - Presence & Status: Bot status updates (online/away/dnd/offline) and user presence tracking
  - Inbound edit events: Receive and process message edits from MatterMost
  
- **Advanced Features**:
  - Metadata cache: User/channel/team lookups with automatic caching (1-hour expiry)
  - Slash command detection: Automatic detection of slash commands
  - Rate limiting: Client-side rate limiter with message queue (429 detection)
  
- **API Methods**:
  - `addReaction(postId, emoji)` - Add reaction to a message
  - `removeReaction(postId, emoji)` - Remove reaction from a message
  - `setBotStatus(status)` - Set bot presence status
  - `getUserStatus(userId)` - Get user presence status
  - `getUserMetadata(userId)` - Get user information (cached)
  - `getChannelMetadata(channelId)` - Get channel information (cached)
  - `getTeamMetadata(teamId)` - Get team information (cached)
  - `getMyTeams()` - List all teams bot is member of
  - `getTeamChannels(teamId)` - List channels in a team
  - `getThreadContext(threadId)` - Get thread participant count and context

### Improved
- Thread handling with participant tracking and context management
- WebSocket event handling (reactions, edits, presence)
- Statistics now include threads, presence, and metadata cache info

## [0.1.0] - 2026-01-29

### Added
- Initial release of MatterMolt - MatterMost channel adapter for MoltBot Gateway
- **Core Features**:
  - Real-time MatterMost integration via Bot API and WebSocket
  - Text message send/receive in DMs and channels
  - File upload/download support (images, audio, video, documents)
  - Auto-reconnect with exponential backoff
  - Typing indicators (sent via WebSocket before messages)
  
- **Security & Access Control**:
  - DM pairing system with 6-character codes (5-minute expiry)
  - `allowFrom` patterns for user allowlisting (supports wildcards)
  - Channel-level access control with mention gating
  - Group policies (`allowlist` / `open` modes)
  - Input sanitization and validation
  - Token redaction in logs
  
- **Session Management**:
  - Isolated sessions per DM, channel, and thread
  - Session mapping: DMs → `agent:main:main`, Channels → `agent:main:mattermost:channel:<id>`
  
- **File Handling**:
  - Small files (<10MB) kept in memory
  - Large files streamed to disk
  - MIME type detection and categorization
  - File size validation (50MB default limit)
  - Support for images (JPEG, PNG, GIF, WebP), audio (MP3, WAV, OGG), video (MP4, WebM), documents (PDF, TXT, MD)
  
- **Logging & Monitoring**:
  - Structured JSON logging with Pino
  - Configurable log levels (debug, info, warn, error)
  - Correlation IDs for request tracking
  - Connection health monitoring with ping/pong
  
- **Configuration**:
  - Flexible JSON-based configuration
  - Per-team and per-channel settings
  - Customizable retry behavior
  - Environment-specific configs (development, production)
  
- **Testing**:
  - 181 unit tests with 52% overall coverage
  - 100% coverage on configuration and session mapping
  - 98% coverage on access control (security-critical)
  - 89% coverage on file handling and logging
  
- **Documentation**:
  - Comprehensive API documentation
  - Example configurations (basic, secure, open)
  - Setup guide for MatterMost bot creation
  - Architecture overview

### Implementation Status

**Completed (Phases 1-3, 5)**:
- ✅ Foundation (config, logging, connection management)
- ✅ Core messaging (session mapping, message handling, chunking)
- ✅ Media & files (upload/download, MIME detection)
- ✅ Access control & security (DM pairing, allowlists, input sanitization)

**Not Yet Implemented (Future)**:
- ⏭️ Rich interactions (reactions, threads, presence) - Phase 4
- ⏭️ Advanced features (multi-account, slash commands) - Phase 6

### Known Limitations
- Thread support is partially implemented (mapping only)
- Reactions not yet supported
- Presence/status updates not implemented
- Multi-account support not implemented
- Slash commands not implemented

### Requirements
- Node.js >= 18.0.0
- MatterMost server version 7.0 or higher
- MoltBot Gateway (compatible version)

[0.1.0]: https://github.com/moltbot/mattermolt/releases/tag/v0.1.0
