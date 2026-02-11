/**
 * MatterMost channel adapter for MoltBot Gateway
 */

import { Logger } from './logger.js';
import type { MattermostConfig } from './config.js';
import { ConnectionState } from './types.js';
import { ConnectionManager } from './connection-manager.js';
import { MessageHandler } from './message-handler.js';
import { AccessController } from './access-controller.js';
import { FileHandler } from './file-handler.js';
import { SessionMapper } from './session-mapper.js';
import { ReactionHandler } from './reaction-handler.js';
import { ThreadContextManager } from './thread-context.js';
import { PresenceHandler, type UserStatus } from './presence-handler.js';
import {
  MetadataCache,
  type UserMetadata,
  type ChannelMetadata,
  type TeamMetadata,
} from './metadata-cache.js';
import type { Channel, ChannelEventHandlers, SendMessageOptions } from './types.js';

/**
 * MatterMost channel adapter
 * Implements the MoltBot Channel interface for MatterMost integration
 */
export class MattermostChannel implements Channel {
  readonly type = 'mattermost';

  private logger: Logger;
  private _config: MattermostConfig;
  private eventHandlers: ChannelEventHandlers;
  private connectionState: ConnectionState;
  private connectionManager: ConnectionManager | null = null;
  private messageHandler: MessageHandler | null = null;
  private accessController: AccessController;
  private fileHandler: FileHandler | null = null;
  private sessionMapper: SessionMapper;
  private reactionHandler: ReactionHandler | null = null;
  private threadContext: ThreadContextManager;
  private presenceHandler: PresenceHandler | null = null;
  private metadataCache: MetadataCache | null = null;

  constructor(config: MattermostConfig, eventHandlers: ChannelEventHandlers = {}) {
    this._config = config;
    this.eventHandlers = eventHandlers;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.logger = new Logger({
      level: config.logLevel,
      component: 'mattermost-channel',
    });

    // Initialize connection manager
    this.connectionManager = new ConnectionManager(config, {
      stateChange: (state) => this.setConnectionState(state),
      message: (data) => void this.handleWebSocketMessage(data),
      error: (error) => this.handleError(error),
      ready: () => void this.handleConnectionReady(),
    });

    // Initialize message handler (with ConnectionManager for typing indicators)
    this.messageHandler = new MessageHandler(
      this.connectionManager.apiClient,
      'main',
      this.connectionManager
    );

    // Initialize access controller
    this.accessController = new AccessController(this.logger, config);

    // Initialize file handler
    this.fileHandler = new FileHandler(this.connectionManager.apiClient, this.logger);

    // Initialize session mapper
    this.sessionMapper = new SessionMapper();

    // Initialize reaction handler
    this.reactionHandler = new ReactionHandler(this.connectionManager.apiClient);

    // Initialize thread context manager
    this.threadContext = new ThreadContextManager();

    // Initialize presence handler
    this.presenceHandler = new PresenceHandler(this.connectionManager.apiClient);

    // Initialize metadata cache
    this.metadataCache = new MetadataCache(this.connectionManager.apiClient);
  }

  /**
   * Whether the channel is currently connected
   */
  get connected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get configuration
   */
  get config(): MattermostConfig {
    return this._config;
  }

  /**
   * Start the channel adapter
   * Initializes connection to MatterMost server
   */
  async start(): Promise<void> {
    if (this.connectionState !== ConnectionState.DISCONNECTED) {
      this.logger.warn('Channel already starting or started');
      return;
    }

    if (!this.connectionManager) {
      throw new Error('Connection manager not initialized');
    }

    this.logger.info('Starting MatterMost channel adapter');

    try {
      // Connect to MatterMost
      await this.connectionManager.connect();

      this.logger.info('MatterMost channel adapter started successfully');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to start channel adapter');
      throw error;
    }
  }

  /**
   * Stop the channel adapter
   * Closes connection to MatterMost server
   */
  async stop(): Promise<void> {
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      this.logger.warn('Channel already stopped');
      return;
    }

    if (!this.connectionManager) {
      return;
    }

    this.logger.info('Stopping MatterMost channel adapter');

    try {
      // Cleanup expired pairings before stopping
      this.accessController.cleanupExpiredPairings();

      await this.connectionManager.disconnect();
      this.logger.info('MatterMost channel adapter stopped successfully');
    } catch (error) {
      this.logger.error({ err: error }, 'Error stopping channel adapter');
      throw error;
    }
  }

  /**
   * Send a message through the channel
   * @param options Message send options
   */
  async send(options: SendMessageOptions): Promise<void> {
    if (!this.connected || !this.messageHandler) {
      throw new Error('Cannot send message: channel not connected');
    }

    this.logger.debug({ sessionId: options.sessionId }, 'Sending message');

    try {
      // Send typing indicator before message (if enabled)
      if (this._config.typingIndicators !== false) {
        await this.sendTyping(options.sessionId, options.threadId);
      }

      await this.messageHandler.sendMessage(options.sessionId, options.content, {
        replyTo: options.replyTo,
        threadId: options.threadId,
      });

      this.logger.debug({ sessionId: options.sessionId }, 'Message sent successfully');
    } catch (error) {
      this.logger.error({ err: error, sessionId: options.sessionId }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Send typing indicator
   * @param sessionId Session ID to send typing indicator for
   * @param threadId Optional thread ID
   */
  async sendTyping(sessionId: string, threadId?: string): Promise<void> {
    if (!this.messageHandler) {
      return;
    }

    try {
      await this.messageHandler.sendTypingIndicator(sessionId, threadId);
    } catch (error) {
      // Non-critical, just log
      this.logger.debug({ err: error, sessionId }, 'Failed to send typing indicator');
    }
  }

  /**
   * Set connection state and notify handlers
   * @param state New connection state
   */
  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    if (previousState !== state) {
      this.logger.debug({ from: previousState, to: state }, 'Connection state changed');

      if (this.eventHandlers.onConnectionStateChange) {
        try {
          this.eventHandlers.onConnectionStateChange(state);
        } catch (error) {
          this.logger.error({ err: error }, 'Error in connection state change handler');
        }
      }
    }
  }

  /**
   * Handle WebSocket message
   */
  private async handleWebSocketMessage(data: unknown): Promise<void> {
    if (!this.messageHandler) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wsEvent = data as any;

      // Handle reaction events
      if (wsEvent.event === 'reaction_added' || wsEvent.event === 'reaction_removed') {
        await this.handleReactionEvent(wsEvent);
        return;
      }

      // Handle post_edited events
      if (wsEvent.event === 'post_edited') {
        await this.handlePostEditedEvent(wsEvent);
        return;
      }

      // Handle status_change events
      if (wsEvent.event === 'status_change' && this.presenceHandler) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userId = wsEvent.data?.user_id as string;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const status = wsEvent.data?.status as UserStatus;
        if (userId && status) {
          this.presenceHandler.handleStatusChange(userId, status);
        }
        return;
      }

      // Handle regular message events
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const messageEvent = await this.messageHandler.transformInboundMessage(wsEvent);

      if (!messageEvent) {
        return;
      }

      // Check access control
      const accessDecision = this.accessController.checkAccess({
        userId: messageEvent.userId,
        channelId: messageEvent.channelId,
        channelType: 'D', // TODO: Get actual channel type from message
        teamId: undefined, // TODO: Extract from message
        isMention: false, // TODO: Detect mentions
      });

      if (!accessDecision.allowed) {
        this.logger.debug(
          { userId: messageEvent.userId, reason: accessDecision.reason },
          'Message blocked by access control'
        );

        // Handle pairing request
        if (accessDecision.requiresPairing && accessDecision.pairingCode) {
          await this.sendPairingMessage(messageEvent.channelId, accessDecision.pairingCode);
        }
        return;
      }

      // Validate message content
      const validation = this.accessController.validateMessage(messageEvent.content.text);
      if (!validation.valid) {
        this.logger.warn(
          { userId: messageEvent.userId, reason: validation.reason },
          'Invalid message content'
        );
        return;
      }

      // Sanitize input
      messageEvent.content.text = this.accessController.sanitizeInput(messageEvent.content.text);

      // Handle file attachments
      if (this.fileHandler && messageEvent.content.files) {
        // TODO: Download and process file attachments
      }

      // Map to session (using proper SessionMapper method)
      // Note: We need post context for proper mapping, using simplified approach here
      let sessionId: string;
      if (messageEvent.threadId) {
        sessionId = this.sessionMapper.mapThreadToSession(messageEvent.threadId);
        // Update thread context
        this.threadContext.getOrCreateContext(messageEvent.threadId, messageEvent.channelId);
        this.threadContext.updateContext(
          messageEvent.threadId,
          messageEvent.userId,
          messageEvent.content.text
        );
      } else if (messageEvent.channelId) {
        // TODO: Check if it's a DM channel type
        sessionId = this.sessionMapper.mapChannelToSession(messageEvent.channelId);
      } else {
        sessionId = this.sessionMapper.mapDmToSession();
      }
      messageEvent.sessionId = sessionId;

      // Forward to Gateway
      if (this.eventHandlers.onMessage) {
        await this.eventHandlers.onMessage(messageEvent);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Error handling WebSocket message');
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error);
      }
    }
  }

  /**
   * Send pairing request message
   */
  private async sendPairingMessage(channelId: string, pairingCode: string): Promise<void> {
    if (!this.messageHandler) {
      return;
    }

    const message = `Hello! To use this bot, please approve the pairing request with code: **${pairingCode}**\n\nThis code will expire in 5 minutes.`;

    try {
      await this.messageHandler.sendMessage(channelId, { text: message }, {});
    } catch (error) {
      this.logger.error({ err: error, channelId }, 'Failed to send pairing message');
    }
  }

  /**
   * Handle post edited events
   */
  private async handlePostEditedEvent(data: unknown): Promise<void> {
    if (!this.messageHandler) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wsEvent = data as any;

      // Transform the edited post to a message event
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const messageEvent = await this.messageHandler.transformInboundMessage(wsEvent);

      if (!messageEvent) {
        return;
      }

      // Mark it as an edit
      if (!messageEvent.content.metadata) {
        messageEvent.content.metadata = {};
      }
      messageEvent.content.metadata.isEdit = true;

      // Forward to Gateway as a regular message (Gateway can handle edits)
      if (this.eventHandlers.onMessage) {
        await this.eventHandlers.onMessage(messageEvent);
      }

      this.logger.debug({ postId: messageEvent.correlationId }, 'Handled post edit event');
    } catch (error) {
      this.logger.error({ err: error }, 'Error handling post edited event');
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error);
      }
    }
  }

  /**
   * Handle reaction events
   */
  private async handleReactionEvent(data: unknown): Promise<void> {
    if (!this.reactionHandler) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reactionEvent = this.reactionHandler.transformReactionEvent(data as any);

      if (!reactionEvent) {
        return;
      }

      // Forward to Gateway
      if (this.eventHandlers.onReaction) {
        await this.eventHandlers.onReaction(reactionEvent);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Error handling reaction event');
      if (this.eventHandlers.onError) {
        this.eventHandlers.onError(error as Error);
      }
    }
  }

  /**
   * Handle connection ready
   */
  private async handleConnectionReady(): Promise<void> {
    this.logger.info('Connection ready');

    // Set bot user ID in all handlers
    if (
      this.connectionManager &&
      this.messageHandler &&
      this.reactionHandler &&
      this.presenceHandler
    ) {
      try {
        const me = await this.connectionManager.apiClient.getMe();
        this.messageHandler.setBotUserId(me.id);
        this.reactionHandler.setBotUserId(me.id);
        this.presenceHandler.setBotUserId(me.id);

        // Set initial bot status to online
        await this.presenceHandler.setBotStatus('online');

        this.logger.debug({ botUserId: me.id }, 'Bot user ID configured');
      } catch (error) {
        this.logger.error({ err: error }, 'Failed to get bot user ID');
      }
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.logger.error({ err: error }, 'Channel error');

    if (this.eventHandlers.onError) {
      try {
        this.eventHandlers.onError(error);
      } catch (handlerError) {
        this.logger.error({ err: handlerError }, 'Error in error handler');
      }
    }
  }

  /**
   * Approve a pairing request
   * @param code The pairing code to approve
   * @returns true if approved, false otherwise
   */
  approvePairing(code: string): boolean {
    return this.accessController.approvePairing(code);
  }

  /**
   * Reject a pairing request
   * @param code The pairing code to reject
   * @returns true if rejected, false otherwise
   */
  rejectPairing(code: string): boolean {
    return this.accessController.rejectPairing(code);
  }

  /**
   * Get pending pairing request by code
   */
  getPendingPairing(code: string) {
    return this.accessController.getPendingPairing(code);
  }

  /**
   * Add a reaction to a message
   * @param postId The post/message ID
   * @param emoji The emoji name (e.g., 'thumbsup', 'smile')
   */
  async addReaction(postId: string, emoji: string): Promise<void> {
    if (!this.reactionHandler) {
      throw new Error('Reaction handler not initialized');
    }

    await this.reactionHandler.addReaction(postId, emoji);
  }

  /**
   * Remove a reaction from a message
   * @param postId The post/message ID
   * @param emoji The emoji name
   */
  async removeReaction(postId: string, emoji: string): Promise<void> {
    if (!this.reactionHandler) {
      throw new Error('Reaction handler not initialized');
    }

    await this.reactionHandler.removeReaction(postId, emoji);
  }

  /**
   * Set bot presence status
   * @param status The status to set (online, away, dnd, offline)
   */
  async setBotStatus(status: UserStatus): Promise<void> {
    if (!this.presenceHandler) {
      throw new Error('Presence handler not initialized');
    }

    await this.presenceHandler.setBotStatus(status);
  }

  /**
   * Get user status
   * @param userId The user ID
   */
  async getUserStatus(userId: string): Promise<UserStatus> {
    if (!this.presenceHandler) {
      throw new Error('Presence handler not initialized');
    }

    const cached = this.presenceHandler.getUserStatus(userId);
    if (cached) {
      return cached;
    }

    return await this.presenceHandler.fetchUserStatus(userId);
  }

  /**
   * Get user metadata
   * @param userId The user ID
   */
  async getUserMetadata(userId: string): Promise<UserMetadata | null> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }

    return await this.metadataCache.getUser(userId);
  }

  /**
   * Get channel metadata
   * @param channelId The channel ID
   */
  async getChannelMetadata(channelId: string): Promise<ChannelMetadata | null> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }

    return await this.metadataCache.getChannel(channelId);
  }

  /**
   * Get team metadata
   * @param teamId The team ID
   */
  async getTeamMetadata(teamId: string): Promise<TeamMetadata | null> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }

    return await this.metadataCache.getTeam(teamId);
  }

  /**
   * Get all teams for the bot
   */
  async getMyTeams(): Promise<TeamMetadata[]> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }

    return await this.metadataCache.getMyTeams();
  }

  /**
   * Get channels in a team
   * @param teamId The team ID
   */
  async getTeamChannels(teamId: string): Promise<ChannelMetadata[]> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }

    return await this.metadataCache.getTeamChannels(teamId);
  }

  /**
   * Get thread context
   * @param threadId The thread root post ID
   */
  getThreadContext(threadId: string) {
    return this.threadContext.getContext(threadId);
  }

  /**
   * Get adapter statistics
   */
  getStats() {
    return {
      connected: this.connected,
      connectionState: this.connectionState,
      accessControl: this.accessController.getStats(),
      threads: this.threadContext.getStats(),
      presence: this.presenceHandler?.getStats(),
      metadata: this.metadataCache?.getStats(),
    };
  }
}
