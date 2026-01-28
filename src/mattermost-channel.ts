/**
 * MatterMost channel adapter for MoltBot Gateway
 */

import { Logger } from './logger.js';
import type { MattermostConfig } from './config.js';
import { ConnectionState } from './types.js';
import { ConnectionManager } from './connection-manager.js';
import { MessageHandler } from './message-handler.js';
import type { Channel, ChannelEventHandlers, SendMessageOptions } from './types.js';

/**
 * MatterMost channel adapter
 * Implements the MoltBot Channel interface for MatterMost integration
 */
export class MattermostChannel implements Channel {
  readonly type = 'mattermost';

  private logger: Logger;
  private eventHandlers: ChannelEventHandlers;
  private connectionState: ConnectionState;
  private connectionManager: ConnectionManager | null = null;
  private messageHandler: MessageHandler | null = null;

  constructor(config: MattermostConfig, eventHandlers: ChannelEventHandlers = {}) {
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

    // Initialize message handler
    this.messageHandler = new MessageHandler(this.connectionManager.apiClient);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const messageEvent = await this.messageHandler.transformInboundMessage(data as any);

      if (messageEvent && this.eventHandlers.onMessage) {
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
   * Handle connection ready
   */
  private async handleConnectionReady(): Promise<void> {
    this.logger.info('Connection ready');

    // Set bot user ID in message handler
    if (this.connectionManager && this.messageHandler) {
      try {
        const me = await this.connectionManager.apiClient.getMe();
        this.messageHandler.setBotUserId(me.id);
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
}
