/**
 * Base types for MoltBot Channel adapter interface
 * These would normally come from @moltbot/types or similar
 */

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * Message content
 */
export interface MessageContent {
  /** Message text */
  text: string;
  /** File attachments */
  files?: FileAttachment[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File attachment
 */
export interface FileAttachment {
  /** File name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** File data (Buffer or URL) */
  data: Buffer | string;
  /** File URL (if hosted) */
  url?: string;
}

/**
 * Reaction
 */
export interface Reaction {
  /** Emoji name (e.g., 'thumbsup', 'smile') */
  emoji: string;
  /** User ID who added the reaction */
  userId: string;
  /** Timestamp when reaction was added */
  timestamp: Date;
}

/**
 * Reaction event
 */
export interface ReactionEvent {
  /** Session ID */
  sessionId: string;
  /** User who added/removed the reaction */
  userId: string;
  /** Post/message ID */
  postId: string;
  /** Emoji name */
  emoji: string;
  /** Action: 'added' or 'removed' */
  action: 'added' | 'removed';
  /** Channel ID */
  channelId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Message event
 */
export interface MessageEvent {
  /** Session ID */
  sessionId: string;
  /** Sender user ID */
  userId: string;
  /** Message content */
  content: MessageContent;
  /** Message timestamp */
  timestamp: Date;
  /** Channel/conversation ID */
  channelId: string;
  /** Thread ID (if reply) */
  threadId?: string;
  /** Correlation ID for tracking */
  correlationId?: string;
  /** Reactions on this message */
  reactions?: Reaction[];
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Session ID */
  sessionId: string;
  /** Message content */
  content: MessageContent;
  /** Reply to message ID */
  replyTo?: string;
  /** Thread ID */
  threadId?: string;
}

/**
 * Base Channel interface
 */
export interface Channel {
  /** Channel type identifier */
  readonly type: string;

  /** Whether the channel is currently connected */
  readonly connected: boolean;

  /**
   * Start the channel adapter
   */
  start(): Promise<void>;

  /**
   * Stop the channel adapter
   */
  stop(): Promise<void>;

  /**
   * Send a message through the channel
   */
  send(options: SendMessageOptions): Promise<void>;
}

/**
 * Channel event handlers
 */
export interface ChannelEventHandlers {
  /** Called when a message is received */
  onMessage?: (event: MessageEvent) => void | Promise<void>;

  /** Called when a reaction is added or removed */
  onReaction?: (event: ReactionEvent) => void | Promise<void>;

  /** Called when connection state changes */
  onConnectionStateChange?: (state: ConnectionState) => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;
}
