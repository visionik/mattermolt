# MatterMolt Technical Specification

**Version**: 1.0
**Date**: 2026-01-27
**Status**: Ready for Implementation

## Overview

MatterMolt is a native MoltBot channel adapter that connects MatterMost to the MoltBot Gateway, enabling AI assistant interactions through MatterMost chat, files, voice, and other features. It implements full feature parity with existing Clawdbot Slack and Discord channel adapters.

### Goals
- Provide real-time MatterMost integration for MoltBot
- Support text, files, images, audio, video, and rich interactions
- Match feature set of Slack/Discord adapters
- Enable fast, responsive bot interactions
- Support both daemon and development modes
- Use modular, plugin-based architecture

### Non-Goals
- Hubot integration (future consideration)
- MatterMost server administration features
- Custom MatterMost client implementation
- Support for MatterMost versions older than 7.0

## Requirements

### Functional Requirements

#### MUST
- Connect to MatterMost via Bot API and WebSocket for real-time events
- Support text message send/receive in DMs and channels
- Support file upload/download (images, audio, video, documents)
- Implement MoltBot's standard access control (DM pairing, allowFrom, group policies)
- Map conversations to sessions following Slack/Discord pattern (DMs → main session, channels → isolated)
- Auto-reconnect with exponential backoff on connection failures
- Support mention detection for group channels
- Handle message reactions (emoji responses)
- Support threaded conversations
- Support message editing and deletion
- Implement typing indicators
- Support presence/status updates
- Enable channel and user lookups
- Configure via `~/.clawdbot/moltbot.json` under `channels.mattermost.*`
- Package as NPM module `moltbot-mattermost`
- Use official `@mattermost/client` library

#### SHOULD
- Support multiple MatterMost accounts/servers
- Provide detailed logging with configurable verbosity
- Include retry configuration options (attempts, delays, jitter)
- Support message chunking for long responses
- Handle rate limiting gracefully
- Support MatterMost slash commands
- Implement session isolation per channel/DM
- Cache user/channel metadata

#### MAY
- Support MatterMost plugins/integrations
- Provide metrics/telemetry
- Support custom emoji
- Implement message search

#### MUST NOT
- Require Hubot installation
- Store credentials in plaintext (use MoltBot's credential management)
- Expose WebSocket connection outside MoltBot Gateway
- Implement custom MatterMost protocol (use official client)

### Non-Functional Requirements

#### Performance
- Message latency MUST be <500ms under normal conditions
- MUST handle 100+ concurrent channel connections
- SHOULD support 1000+ messages/hour throughput
- Memory usage SHOULD remain stable over 24+ hour runtime

#### Security
- MUST use TLS for MatterMost connections
- MUST validate bot token on startup
- MUST implement DM pairing by default
- MUST respect MoltBot's allowlist/deny-list patterns
- SHOULD log security-relevant events

#### Reliability
- MUST auto-reconnect on WebSocket disconnection
- MUST persist message queue during reconnection
- SHOULD handle partial failures gracefully
- MUST NOT crash Gateway on MatterMost API errors

#### Maintainability
- MUST follow MoltBot channel adapter patterns
- SHOULD use TypeScript strict mode
- MUST include inline documentation
- SHOULD maintain <80% code duplication with Slack/Discord adapters

## Architecture

### High-Level Architecture

```
┌─────────────┐
│ MatterMost  │
│   Server    │
└──────┬──────┘
       │ Bot API + WebSocket
       │
┌──────▼──────────────────────────┐
│   MatterMolt Channel Adapter    │
│  (TypeScript, runs in Gateway)  │
├─────────────────────────────────┤
│ • Connection Manager            │
│ • Message Handler               │
│ • File Handler                  │
│ • Session Mapper                │
│ • Access Control                │
└──────┬──────────────────────────┘
       │ Gateway Events
       │
┌──────▼──────────────────────────┐
│      MoltBot Gateway            │
│  (sessions, tools, agent)       │
└─────────────────────────────────┘
```

### Component Architecture

#### 1. MattermostChannel (Main Adapter)
- Extends MoltBot's base Channel class
- Manages lifecycle (start, stop, reconnect)
- Registers with Gateway
- Routes events to/from Gateway

#### 2. ConnectionManager
- Handles WebSocket connection to MatterMost
- Implements reconnection logic with exponential backoff
- Manages authentication
- Monitors connection health

#### 3. MessageHandler
- Receives MatterMost events (posted, edited, deleted, reaction)
- Transforms to MoltBot message format
- Sends outbound messages to MatterMost
- Handles message chunking
- Manages typing indicators

#### 4. FileHandler
- Downloads files from MatterMost
- Uploads files to MatterMost
- Handles media transcoding if needed
- Manages file size limits

#### 5. SessionMapper
- Maps MatterMost conversations to MoltBot sessions
- DM format: `agent:main:main`
- Channel format: `agent:<agentId>:mattermost:channel:<channelId>`
- Thread format: `agent:<agentId>:mattermost:thread:<threadId>`

#### 6. AccessController
- Validates sender permissions via allowFrom lists
- Implements DM pairing flow
- Enforces group chat policies (mention gating)
- Integrates with MoltBot's approval system

#### 7. ConfigManager
- Loads configuration from `channels.mattermost.*`
- Validates required settings (url, token, etc.)
- Supports multi-account configuration
- Provides defaults

### Data Flow

#### Inbound Message Flow
1. MatterMost WebSocket receives `posted` event
2. MessageHandler transforms to MoltBot format
3. AccessController validates sender
4. SessionMapper determines session ID
5. Gateway receives message event
6. Agent processes message
7. Response flows back through outbound flow

#### Outbound Message Flow
1. Gateway emits send event
2. MattermostChannel receives event
3. SessionMapper extracts channel/thread info
4. MessageHandler formats for MatterMost API
5. FileHandler attaches media if present
6. MatterMost REST API sends message
7. Confirmation flows back to Gateway

## Implementation Plan

### Phase 1: Foundation (Est: 16-24 hours)

#### Subphase 1.1: Project Setup (4-6 hours)
**Dependencies**: None

**Task 1.1.1: Repository Initialization**
- Create GitHub repository `mattermolt`
- Initialize TypeScript project with `tsconfig.json`
- Configure ESLint and Prettier
- Add `.gitignore` for Node.js
- Create `package.json` with metadata
- **Acceptance**: `npm install` succeeds, `npm run lint` passes

**Task 1.1.2: Development Environment**
- Add TypeScript strict mode configuration
- Configure build scripts (`build`, `watch`, `dev`)
- Set up source maps
- Add nodemon for development
- **Acceptance**: `npm run build` produces `dist/` output, `npm run dev` watches changes

**Task 1.1.3: Testing Infrastructure**
- Install Jest and ts-jest
- Configure Jest for TypeScript
- Add test scripts (`test`, `test:watch`, `test:coverage`)
- Create test fixture structure
- **Acceptance**: `npm test` runs successfully (even with no tests)

**Task 1.1.4: Documentation Structure**
- Create README.md with project overview
- Add CONTRIBUTING.md
- Add LICENSE (MIT or Apache 2.0)
- Document MatterMost bot setup instructions
- **Acceptance**: README explains installation and basic usage

#### Subphase 1.2: Core Structure (6-8 hours)
**Dependencies**: Subphase 1.1

**Task 1.2.1: Install Dependencies**
- Add `@mattermost/client` (official client)
- Add MoltBot types/interfaces (or define locally if not exported)
- Add WebSocket client library
- Add logging library (winston or pino)
- **Acceptance**: `npm install` completes, types resolve in IDE

**Task 1.2.2: Channel Adapter Skeleton**
- Create `src/index.ts` with module exports
- Create `src/mattermost-channel.ts` with Channel base class
- Implement required Channel interface methods (start, stop, send)
- Add channel registration function
- **Acceptance**: Module exports valid Channel instance

**Task 1.2.3: Configuration Schema**
- Define TypeScript interfaces for config (`MattermostConfig`)
- Required fields: `url`, `token`, `enabled`
- Optional fields: `allowFrom`, `dm`, `teams`, `retry`
- Add validation logic
- **Acceptance**: Config validates correctly, rejects invalid configs

**Task 1.2.4: Logging Setup**
- Create logger instance with configurable levels
- Add log methods (debug, info, warn, error)
- Include correlation IDs for message tracking
- Support redaction of sensitive data (tokens)
- **Acceptance**: Logs output with proper formatting and levels

#### Subphase 1.3: Connection Management (6-10 hours)
**Dependencies**: Subphase 1.2

**Task 1.3.1: MatterMost Client Initialization**
- Create `src/connection-manager.ts`
- Initialize `@mattermost/client` with config
- Implement authentication
- Verify bot user permissions
- **Acceptance**: Successful connection to test MatterMost server

**Task 1.3.2: WebSocket Connection**
- Establish WebSocket connection to MatterMost
- Handle authentication for WebSocket
- Subscribe to relevant events (`posted`, `post_edited`, `post_deleted`, `reaction_added`, `reaction_removed`)
- **Acceptance**: WebSocket connects and receives hello event

**Task 1.3.3: Reconnection Logic**
- Implement exponential backoff (initial: 1s, max: 60s, multiplier: 2)
- Add jitter to prevent thundering herd
- Track connection state (connecting, connected, reconnecting, disconnected)
- Emit connection events to Gateway
- **Acceptance**: Automatic reconnection after simulated disconnect

**Task 1.3.4: Health Monitoring**
- Implement ping/pong heartbeat
- Detect stale connections
- Report health status to Gateway
- **Acceptance**: Detects and recovers from stale connection

**Testing for Phase 1**:
- Unit tests for config validation
- Unit tests for exponential backoff logic
- Integration test: connect to local MatterMost instance
- Integration test: reconnect after disconnect

### Phase 2: Core Messaging (Est: 20-28 hours)
**Dependencies**: Phase 1

#### Subphase 2.1: Inbound Messages (8-12 hours)
**Dependencies**: Phase 1

**Task 2.1.1: Message Event Handling**
- Create `src/message-handler.ts`
- Listen for `posted` WebSocket events
- Extract message metadata (sender, channel, timestamp, text)
- Handle different post types (regular, reply, system)
- **Acceptance**: Logs received messages with correct metadata

**Task 2.1.2: Message Transformation**
- Transform MatterMost message format to MoltBot format
- Map user IDs to MoltBot user format
- Convert MatterMost markdown to MoltBot format
- Preserve message context (channel name, thread ID)
- **Acceptance**: Transformed messages match MoltBot schema

**Task 2.1.3: Session Mapping**
- Create `src/session-mapper.ts`
- Implement DM → `agent:main:main` mapping
- Implement channel → `agent:main:mattermost:channel:<id>` mapping
- Implement thread → `agent:main:mattermost:thread:<id>` mapping
- **Acceptance**: Correct session IDs generated for each message type

**Task 2.1.4: Event Routing to Gateway**
- Emit transformed messages to Gateway
- Include session metadata
- Handle Gateway acknowledgments
- **Acceptance**: Gateway receives and processes messages

#### Subphase 2.2: Outbound Messages (8-12 hours)
**Dependencies**: Subphase 2.1

**Task 2.2.1: Gateway Event Listening**
- Listen for Gateway send events
- Extract destination (channel/DM/thread)
- Queue messages for sending
- **Acceptance**: Receives Gateway events correctly

**Task 2.2.2: Message Formatting**
- Transform MoltBot format to MatterMost format
- Convert markdown as needed
- Handle mentions (@user)
- Chunk long messages (max 4000 chars per post)
- **Acceptance**: Messages formatted correctly for MatterMost API

**Task 2.2.3: Message Sending**
- Send via MatterMost REST API (`createPost`)
- Handle responses and errors
- Track message IDs for edits/deletes
- Implement retry for transient failures
- **Acceptance**: Messages appear in MatterMost

**Task 2.2.4: Typing Indicators**
- Send typing events when agent is processing
- Clear typing when message sent
- Respect typing timeout (10s)
- **Acceptance**: "Bot is typing..." shows in MatterMost

#### Subphase 2.3: Message Editing & Deletion (4 hours)
**Dependencies**: Subphase 2.2

**Task 2.3.1: Edit Support**
- Listen for `post_edited` events from MatterMost
- Support editing bot's own messages via Gateway
- Update message cache
- **Acceptance**: Edits reflected in both directions

**Task 2.3.2: Delete Support**
- Listen for `post_deleted` events
- Support deleting bot's messages via Gateway
- Clean up message cache
- **Acceptance**: Deletions work in both directions

**Testing for Phase 2**:
- Unit tests for message transformation
- Unit tests for session mapping logic
- Integration test: send message from MatterMost → Gateway
- Integration test: send message from Gateway → MatterMost
- Integration test: edit and delete messages
- Manual test: verify typing indicators

### Phase 3: Media & Files (Est: 12-16 hours)
**Dependencies**: Phase 2

#### Subphase 3.1: File Download (6-8 hours)
**Dependencies**: Phase 2

**Task 3.1.1: File Handler Setup**
- Create `src/file-handler.ts`
- Detect file attachments in `posted` events
- Extract file metadata (name, size, mime type, URL)
- **Acceptance**: File metadata correctly extracted

**Task 3.1.2: File Download**
- Download files via MatterMost API (`getFile`)
- Stream large files to disk
- Validate file size against limits
- **Acceptance**: Files downloaded successfully

**Task 3.1.3: File Attachment to Messages**
- Attach file data to MoltBot message events
- Include file metadata
- Handle multiple attachments
- **Acceptance**: Gateway receives messages with file data

#### Subphase 3.2: File Upload (6-8 hours)
**Dependencies**: Subphase 3.1

**Task 3.2.1: Upload Handler**
- Accept file data from Gateway events
- Upload via MatterMost API (`uploadFile`)
- Get file ID for post attachment
- **Acceptance**: Files upload successfully

**Task 3.2.2: Attach Files to Posts**
- Link uploaded files to outbound posts
- Support multiple file attachments
- Handle upload failures gracefully
- **Acceptance**: Posts with files appear correctly

**Task 3.2.3: Media Type Handling**
- Support images (JPEG, PNG, GIF, WebP)
- Support audio (MP3, WAV, OGG)
- Support video (MP4, WebM)
- Support documents (PDF, TXT, MD)
- **Acceptance**: All media types handled correctly

**Testing for Phase 3**:
- Unit tests for file metadata extraction
- Integration test: receive message with image
- Integration test: send message with file
- Integration test: large file handling (>10MB)
- Manual test: verify file preview in MatterMost

### Phase 4: Rich Interactions (Est: 12-16 hours)
**Dependencies**: Phase 3

#### Subphase 4.1: Reactions (4-6 hours)
**Dependencies**: Phase 3

**Task 4.1.1: Reaction Events**
- Listen for `reaction_added` and `reaction_removed` events
- Transform to MoltBot reaction format
- Route to Gateway
- **Acceptance**: Reactions received by Gateway

**Task 4.1.2: Add Reactions**
- Support adding reactions from Gateway
- Use MatterMost API (`saveReaction`)
- Handle emoji name mapping
- **Acceptance**: Bot adds reactions to messages

**Task 4.1.3: Remove Reactions**
- Support removing reactions from Gateway
- Use MatterMost API (`deleteReaction`)
- **Acceptance**: Bot removes reactions

#### Subphase 4.2: Threads (4-6 hours)
**Dependencies**: Subphase 4.1

**Task 4.2.1: Thread Detection**
- Detect thread replies (`root_id` field)
- Map threads to isolated sessions
- Maintain thread context
- **Acceptance**: Thread messages isolated correctly

**Task 4.2.2: Thread Replies**
- Send messages as thread replies
- Use `root_id` for threading
- **Acceptance**: Bot replies in threads

#### Subphase 4.3: Presence & Status (4 hours)
**Dependencies**: Subphase 4.2

**Task 4.3.1: Bot Presence**
- Set bot status (online, away, dnd, offline)
- Update status based on Gateway state
- **Acceptance**: Bot status reflects Gateway state

**Task 4.3.2: User Presence Tracking**
- Monitor user status events
- Provide presence to Gateway if needed
- **Acceptance**: User presence tracked

**Testing for Phase 4**:
- Integration test: add/remove reactions
- Integration test: threaded conversations
- Integration test: presence updates
- Manual test: verify reaction UI in MatterMost

### Phase 5: Access Control & Security (Est: 10-14 hours)
**Dependencies**: Phase 4

#### Subphase 5.1: Access Control (6-8 hours)
**Dependencies**: Phase 4

**Task 5.1.1: Access Controller**
- Create `src/access-controller.ts`
- Implement `allowFrom` list checking
- Validate users against config
- **Acceptance**: Unauthorized users blocked

**Task 5.1.2: DM Pairing**
- Generate pairing codes for unknown DM senders
- Store pairing state
- Implement approval via Gateway
- **Acceptance**: DM pairing flow works end-to-end

**Task 5.1.3: Group Policies**
- Implement mention gating for channels
- Support `groupPolicy: "allowlist"` and `"open"`
- Check `requireMention` settings
- **Acceptance**: Group policies enforced correctly

**Task 5.1.4: Team/Channel Allowlists**
- Support per-team configuration
- Support per-channel allow/deny lists
- **Acceptance**: Fine-grained access control works

#### Subphase 5.2: Security Hardening (4-6 hours)
**Dependencies**: Subphase 5.1

**Task 5.2.1: Token Security**
- Never log tokens in plaintext
- Use redaction for token logging
- Validate token format
- **Acceptance**: No tokens in logs

**Task 5.2.2: Input Validation**
- Sanitize all user inputs
- Validate message lengths
- Prevent injection attacks
- **Acceptance**: Malicious inputs handled safely

**Task 5.2.3: Rate Limiting**
- Respect MatterMost rate limits
- Implement client-side rate limiting
- Queue messages during rate limit
- **Acceptance**: No 429 errors under normal load

**Testing for Phase 5**:
- Unit tests for access control logic
- Integration test: DM pairing flow
- Integration test: mention gating
- Integration test: rate limiting
- Security test: token redaction
- Security test: malicious input handling

### Phase 6: Advanced Features (Est: 12-16 hours)
**Dependencies**: Phase 5

#### Subphase 6.1: Multi-Account Support (4-6 hours)
**Dependencies**: Phase 5

**Task 6.1.1: Account Configuration**
- Support `channels.mattermost.accounts` array
- Each account: `url`, `token`, `name`
- **Acceptance**: Config supports multiple accounts

**Task 6.1.2: Per-Account Connections**
- Create separate ConnectionManager per account
- Route messages to correct account
- Handle per-account sessions
- **Acceptance**: Multiple accounts connect simultaneously

#### Subphase 6.2: Metadata & Lookups (4-6 hours)
**Dependencies**: Subphase 6.1

**Task 6.2.1: User Lookup**
- Implement user ID → username/email lookup
- Cache user data
- Refresh cache periodically
- **Acceptance**: User lookups fast and accurate

**Task 6.2.2: Channel Lookup**
- Implement channel ID → name lookup
- Support team context
- Cache channel data
- **Acceptance**: Channel lookups work

**Task 6.2.3: Team/Channel Management**
- List teams bot is member of
- List channels in team
- Get channel members
- **Acceptance**: Management operations work

#### Subphase 6.3: Slash Commands (4 hours)
**Dependencies**: Subphase 6.2

**Task 6.3.1: Command Detection**
- Detect MatterMost slash commands directed at bot
- Parse command and arguments
- **Acceptance**: Commands detected correctly

**Task 6.3.2: Command Routing**
- Route slash commands to Gateway
- Support standard MoltBot commands
- **Acceptance**: Slash commands work like DMs

**Testing for Phase 6**:
- Integration test: multi-account setup
- Integration test: user/channel lookups
- Integration test: slash commands
- Performance test: cache effectiveness

### Phase 7: Polish & Documentation (Est: 8-12 hours)
**Dependencies**: Phase 6

#### Subphase 7.1: Configuration Examples (2-3 hours)
**Dependencies**: Phase 6

**Task 7.1.1: Example Configs**
- Create `examples/` directory
- Add basic config example
- Add multi-account example
- Add security-hardened example
- **Acceptance**: Examples are copy-paste ready

#### Subphase 7.2: User Documentation (3-5 hours)
**Dependencies**: Subphase 7.1

**Task 7.2.1: Installation Guide**
- Document npm installation
- Document MatterMost bot creation
- Document config setup
- **Acceptance**: New user can set up from docs

**Task 7.2.2: Configuration Reference**
- Document all config options
- Include defaults and valid values
- Provide troubleshooting tips
- **Acceptance**: All settings documented

**Task 7.2.3: API Documentation**
- Generate TypeDoc or similar
- Document public interfaces
- **Acceptance**: API docs published

#### Subphase 7.3: Developer Documentation (3-4 hours)
**Dependencies**: Subphase 7.2

**Task 7.3.1: Architecture Documentation**
- Document component relationships
- Add architecture diagrams
- Explain data flows
- **Acceptance**: Developers can understand codebase

**Task 7.3.2: Contributing Guide**
- Document development setup
- Explain testing procedures
- Define PR process
- **Acceptance**: Contributors know how to contribute

**Task 7.3.3: Troubleshooting Guide**
- Common issues and solutions
- Debug logging instructions
- Connection issues
- **Acceptance**: Common problems documented

**Testing for Phase 7**:
- Review all documentation for accuracy
- Test examples against real MatterMost
- Verify all links work
- Proofread for clarity

### Phase 8: Release Preparation (Est: 6-8 hours)
**Dependencies**: Phase 7

#### Subphase 8.1: Packaging (3-4 hours)
**Dependencies**: Phase 7

**Task 8.1.1: NPM Package Configuration**
- Finalize `package.json` metadata
- Configure `.npmignore`
- Add prepublish scripts
- Test package locally with `npm link`
- **Acceptance**: Package installs correctly

**Task 8.1.2: Version & Changelog**
- Set version to 1.0.0
- Create CHANGELOG.md
- Document all features
- **Acceptance**: Changelog complete

#### Subphase 8.2: CI/CD (3-4 hours)
**Dependencies**: Subphase 8.1

**Task 8.2.1: GitHub Actions**
- Add test workflow
- Add lint workflow
- Add build workflow
- Add release workflow (publish to npm)
- **Acceptance**: CI passes on main branch

**Task 8.2.2: Release Process**
- Document release steps
- Test dry-run publish
- Publish v1.0.0 to npm
- Create GitHub release
- **Acceptance**: Package available on npm

**Testing for Phase 8**:
- Smoke test: install from npm in clean project
- Smoke test: verify all features work
- Verify CI/CD pipelines work

## Testing Strategy

### Unit Tests
- **Scope**: Individual functions and classes
- **Tools**: Jest with ts-jest
- **Coverage Target**: 80%+ line coverage
- **Focus Areas**:
  - Configuration validation
  - Message transformation
  - Session mapping
  - Access control logic
  - Exponential backoff
  - File metadata extraction

### Integration Tests
- **Scope**: Component interactions and MatterMost API
- **Tools**: Jest with real MatterMost instance
- **Setup**: Local MatterMost server in Docker
- **Test Cases**:
  - Connect to MatterMost
  - Send/receive messages
  - File upload/download
  - Reactions, edits, deletes
  - Access control enforcement
  - Reconnection after disconnect
  - Multi-account handling

### Manual Testing
- **Scope**: End-to-end user flows
- **Environment**: Real MatterMost + MoltBot Gateway
- **Test Cases**:
  - Complete DM conversation
  - Channel conversation with mentions
  - Thread conversation
  - File sharing (images, documents)
  - Typing indicators visible
  - Presence updates
  - DM pairing flow
  - Multi-account switching

### Performance Testing
- **Scope**: Load and stress testing
- **Tools**: Custom scripts
- **Test Cases**:
  - 100 concurrent connections
  - 1000 messages/hour throughput
  - Large file (50MB) upload/download
  - Memory usage over 24 hours
  - Reconnection under load

### Security Testing
- **Scope**: Vulnerability and access control
- **Test Cases**:
  - Token not logged
  - Unauthorized access blocked
  - DM pairing required for unknown users
  - Mention gating enforced
  - Malicious input sanitized
  - Rate limiting prevents abuse

## Deployment

### Development
1. Clone repository
2. `npm install`
3. Create test MatterMost server (Docker recommended)
4. Create bot account and get token
5. Configure `~/.clawdbot/moltbot.json` with test credentials
6. `npm run dev` to run with hot reload
7. Send test message in MatterMost

### Production
1. Install MoltBot: `npm install -g clawdbot@latest`
2. Install MatterMolt: `npm install -g moltbot-mattermost@latest`
3. Create MatterMost bot account
4. Configure `~/.clawdbot/moltbot.json`:
```json
{
  "channels": {
    "mattermost": {
      "enabled": true,
      "url": "https://mattermost.example.com",
      "token": "your-bot-token",
      "dm": {
        "policy": "pairing"
      },
      "teams": {
        "your-team-id": {
          "channels": {
            "general": {
              "allow": true,
              "requireMention": true
            }
          }
        }
      }
    }
  }
}
```
5. Start Gateway: `moltbot gateway`
6. Test by DMing the bot

### Docker
- MatterMolt runs inside MoltBot Gateway container
- Add MatterMolt to Gateway Dockerfile
- Include config via volume mount or env vars

### Monitoring
- Use MoltBot's built-in health checks
- Monitor logs for connection issues
- Track message latency
- Alert on reconnection failures

## Maintenance & Support

### Versioning
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Breaking changes increment MAJOR
- New features increment MINOR
- Bug fixes increment PATCH

### Backwards Compatibility
- Maintain config compatibility within MAJOR version
- Deprecate features before removal
- Provide migration guides for breaking changes

### Known Limitations
- Requires MatterMost 7.0+
- File size limited by MatterMost server config
- Typing indicators may be rate-limited by MatterMost
- Presence updates depend on MatterMost WebSocket events
- Custom emoji require manual import to MatterMost

### Future Enhancements
- Hubot compatibility mode
- Advanced message formatting (cards, buttons)
- Voice/video call integration
- Screen sharing support
- Message search via MatterMost API
- Analytics and usage metrics
- Custom MatterMost plugins
