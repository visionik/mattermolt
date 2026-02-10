# MatterMolt API Documentation

## Table of Contents
- [Configuration](#configuration)
- [MattermostChannel API](#mattermostchannel-api)
- [Access Control](#access-control)
- [Events](#events)

## Configuration

### MattermostConfig

Complete configuration schema for the MatterMost adapter.

```typescript
interface MattermostConfig {
  enabled: boolean;              // Enable/disable the adapter
  url: string;                   // MatterMost server URL
  token: string;                 // Bot access token
  dm?: DmPolicyConfig;          // DM access policy
  allowFrom?: string[];         // Allowed user patterns
  groupPolicy?: 'allowlist' | 'open';  // Channel access policy
  teams?: Record<string, TeamConfig>;  // Per-team configuration
  retry?: RetryConfig;          // Connection retry settings
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // Log level
  typingIndicators?: boolean;   // Send typing indicators (default: true)
}
```

### DM Policy Configuration

```typescript
interface DmPolicyConfig {
  policy?: 'open' | 'pairing';  // Default: 'pairing'
}
```

- **`open`**: Allow all DMs without pairing
- **`pairing`**: Require pairing approval for new users (recommended)

### Group Policy

```typescript
groupPolicy?: 'allowlist' | 'open'  // Default: 'allowlist'
```

- **`allowlist`**: Only allow explicitly configured channels
- **`open`**: Allow all channels

### Team & Channel Configuration

```typescript
interface TeamConfig {
  channels?: Record<string, ChannelConfig>;
}

interface ChannelConfig {
  allow?: boolean;            // Allow bot in this channel
  requireMention?: boolean;   // Require @mention to trigger
}
```

### Retry Configuration

```typescript
interface RetryConfig {
  initialDelay?: number;    // Initial delay in ms (default: 1000)
  maxDelay?: number;       // Max delay in ms (default: 60000)
  multiplier?: number;     // Backoff multiplier (default: 2)
  jitter?: boolean;        // Add random jitter (default: true)
  maxAttempts?: number;    // Max retry attempts (default: 0 = infinite)
}
```

### Allow Patterns

The `allowFrom` array supports:
- **Exact user IDs**: `"user-id-123"`
- **Email patterns**: `"*@company.com"`, `"admin@*"`
- **Username patterns**: `"admin*"`, `"*-bot"`

Patterns are case-insensitive and support wildcard `*`.

## MattermostChannel API

### Constructor

```typescript
new MattermostChannel(config: MattermostConfig, eventHandlers?: ChannelEventHandlers)
```

Creates a new MatterMost channel adapter instance.

**Parameters:**
- `config`: MatterMost configuration
- `eventHandlers`: Optional event callbacks

### Properties

#### `type: string`
Returns `"mattermost"` - the channel type identifier.

#### `connected: boolean`
Returns `true` if currently connected to MatterMost server.

#### `state: ConnectionState`
Current connection state: `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `FAILED`.

#### `config: MattermostConfig`
The current configuration (read-only).

### Methods

#### `start(): Promise<void>`
Connects to the MatterMost server and starts receiving messages.

```typescript
const channel = new MattermostChannel(config);
await channel.start();
```

**Throws:** Error if connection fails

#### `stop(): Promise<void>`
Disconnects from the MatterMost server.

```typescript
await channel.stop();
```

#### `send(options: SendMessageOptions): Promise<void>`
Sends a message through the channel.

Automatically sends a typing indicator before the message (if `typingIndicators` is enabled in config).

```typescript
await channel.send({
  sessionId: 'agent:main:mattermost:channel:abc123',
  content: {
    text: 'Hello from the bot!',
    files: [/* optional file attachments */]
  },
  replyTo: 'message-id',    // Optional
  threadId: 'thread-id'     // Optional
});
```

**Parameters:**
- `sessionId`: Target session ID
- `content`: Message content (text and optional files)
- `replyTo`: Optional message ID to reply to
- `threadId`: Optional thread ID for threaded replies

#### `sendTyping(sessionId: string, threadId?: string): Promise<void>`
Manually sends a typing indicator.

```typescript
await channel.sendTyping('agent:main:mattermost:channel:abc123');
```

**Parameters:**
- `sessionId`: Target session ID
- `threadId`: Optional thread ID for threaded typing indicators

#### `approvePairing(code: string): boolean`
Approves a DM pairing request.

```typescript
const approved = channel.approvePairing('ABC123');
```

**Returns:** `true` if pairing was approved, `false` if code invalid/expired

#### `rejectPairing(code: string): boolean`
Rejects a DM pairing request.

```typescript
const rejected = channel.rejectPairing('ABC123');
```

**Returns:** `true` if pairing was rejected, `false` if code invalid

#### `getPendingPairing(code: string): PairingRequest | undefined`
Gets information about a pending pairing request.

```typescript
const pairing = channel.getPendingPairing('ABC123');
if (pairing) {
  console.log(`User ${pairing.username} requested pairing`);
}
```

#### `addReaction(postId: string, emoji: string): Promise<void>`
Adds an emoji reaction to a message.

```typescript
await channel.addReaction('post-id-123', 'thumbsup');
```

#### `removeReaction(postId: string, emoji: string): Promise<void>`
Removes an emoji reaction from a message.

```typescript
await channel.removeReaction('post-id-123', 'thumbsup');
```

#### `setBotStatus(status: UserStatus): Promise<void>`
Sets the bot's presence status.

```typescript
await channel.setBotStatus('online'); // 'online' | 'away' | 'dnd' | 'offline'
```

#### `getUserStatus(userId: string): Promise<UserStatus>`
Gets a user's presence status (cached or from API).

```typescript
const status = await channel.getUserStatus('user-id-123');
```

#### `getUserMetadata(userId: string): Promise<UserMetadata | null>`
Gets user metadata (username, email, etc.) with automatic caching.

```typescript
const user = await channel.getUserMetadata('user-id-123');
if (user) {
  console.log(user.username, user.email);
}
```

#### `getChannelMetadata(channelId: string): Promise<ChannelMetadata | null>`
Gets channel metadata (name, type, etc.) with automatic caching.

```typescript
const channel = await channel.getChannelMetadata('channel-id-123');
```

#### `getTeamMetadata(teamId: string): Promise<TeamMetadata | null>`
Gets team metadata with automatic caching.

```typescript
const team = await channel.getTeamMetadata('team-id-123');
```

#### `getMyTeams(): Promise<TeamMetadata[]>`
Lists all teams the bot is a member of.

```typescript
const teams = await channel.getMyTeams();
```

#### `getTeamChannels(teamId: string): Promise<ChannelMetadata[]>`
Lists all channels in a team that the bot can access.

```typescript
const channels = await channel.getTeamChannels('team-id-123');
```

#### `getThreadContext(threadId: string): ThreadContext | undefined`
Gets thread context (participants, last activity, subject).

```typescript
const thread = channel.getThreadContext('thread-root-id');
if (thread) {
  console.log(`${thread.participants.size} participants`);
}
```

#### `getStats(): object`
Returns adapter statistics.

```typescript
const stats = channel.getStats();
// {
//   connected: true,
//   connectionState: 'CONNECTED',
//   accessControl: { pairedUsers: 5, pendingPairings: 2 },
//   threads: { totalThreads: 12, maxContexts: 1000 },
//   presence: { botStatus: 'online', trackedUsers: 25 },
//   metadata: { users: 50, channels: 10, teams: 2 }
// }
```

## Access Control

### DM Pairing Flow

When DM policy is set to `"pairing"`:

1. User sends first DM to bot
2. Bot responds with pairing code (6-character hex)
3. Admin approves pairing via `approvePairing(code)`
4. User can now interact with bot

**Pairing codes expire after 5 minutes.**

### Channel Access

Channels must be explicitly allowed when `groupPolicy` is `"allowlist"`:

```json
{
  "teams": {
    "team-id": {
      "channels": {
        "channel-name": {
          "allow": true,
          "requireMention": true
        }
      }
    }
  }
}
```

### Mention Gating

When `requireMention: true`, users must @mention the bot:

```
@botname help
```

Messages without mentions are ignored.

## Events

### Event Handlers

```typescript
interface ChannelEventHandlers {
  onMessage?: (event: MessageEvent) => void | Promise<void>;
  onReaction?: (event: ReactionEvent) => void | Promise<void>;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}
```

### ReactionEvent

```typescript
interface ReactionEvent {
  sessionId: string;   // Session identifier
  userId: string;      // User who added/removed reaction
  postId: string;      // Post/message ID
  emoji: string;       // Emoji name (e.g., 'thumbsup')
  action: 'added' | 'removed';  // Action type
  channelId: string;   // Channel ID
  timestamp: Date;     // Timestamp
}
```

### MessageEvent

```typescript
interface MessageEvent {
  sessionId: string;         // Session identifier
  userId: string;           // Sender user ID
  content: MessageContent;  // Message content
  timestamp: Date;          // Message timestamp
  channelId: string;       // Source channel ID
  threadId?: string;       // Thread ID if in thread
  correlationId?: string;  // Correlation ID
}

interface MessageContent {
  text: string;                    // Message text
  files?: FileAttachment[];        // File attachments
  metadata?: Record<string, any>;  // Additional metadata
}
```

### Connection States

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}
```

## Session Mapping

MatterMolt maps MatterMost conversations to session IDs:

- **DMs**: `agent:main:main`
- **Channels**: `agent:main:mattermost:channel:<channelId>`
- **Threads**: `agent:main:mattermost:thread:<threadId>`

This allows isolated conversation contexts per channel/thread.

## Error Handling

All errors are logged and optionally reported via the `onError` event handler:

```typescript
const channel = new MattermostChannel(config, {
  onError: (error) => {
    console.error('Channel error:', error);
  }
});
```

Common errors:
- **Authentication failure**: Invalid token or insufficient permissions
- **Connection timeout**: Cannot reach MatterMost server
- **Rate limiting**: Too many API requests

## Security Features

### Input Sanitization
All user input is automatically:
- Trimmed of whitespace
- Limited to 4000 characters
- Stripped of null bytes
- Validated for control characters

### Token Security
Bot tokens are:
- Never logged in plaintext
- Redacted in debug output
- Stored only in memory

### Message Validation
Messages are rejected if they:
- Exceed 16,000 characters
- Contain null bytes
- Contain invalid control characters

## Example Usage

### Basic Setup

```typescript
import { MattermostChannel } from 'moltbot-mattermost';

const config = {
  enabled: true,
  url: 'https://mattermost.example.com',
  token: process.env.MATTERMOST_TOKEN,
  dm: { policy: 'pairing' },
  groupPolicy: 'allowlist'
};

const channel = new MattermostChannel(config, {
  onMessage: async (event) => {
    console.log('Message received:', event.content.text);
    
    // Process message...
    
    // Send response
    await channel.send({
      sessionId: event.sessionId,
      content: { text: 'Got your message!' }
    });
  },
  
  onConnectionStateChange: (state) => {
    console.log('Connection state:', state);
  },
  
  onError: (error) => {
    console.error('Error:', error);
  }
});

await channel.start();
```

### Pairing Management

```typescript
// Listen for pairing requests in messages
const pairingCodeRegex = /pairing.*?([A-F0-9]{6})/i;

channel.on('message', async (event) => {
  const match = event.content.text.match(pairingCodeRegex);
  
  if (match) {
    const code = match[1];
    const pairing = channel.getPendingPairing(code);
    
    if (pairing) {
      // Auto-approve if from allowed domain
      if (pairing.username.endsWith('@company.com')) {
        channel.approvePairing(code);
        console.log(`Auto-approved pairing for ${pairing.username}`);
      }
    }
  }
});
```
