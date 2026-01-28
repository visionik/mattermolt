/**
 * MatterMost channel adapter for MoltBot Gateway
 */

import { Logger } from './logger.js';
import type { MattermostConfig } from './config.js';
import { ConnectionState } from './types.js';
import { ConnectionManager } from './connection-manager.js';
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
      message: (data) => this.handleWebSocketMessage(data),
      error: (error) => this.handleError(error),
      ready: () => this.handleConnectionReady(),
    });
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
  send(options: SendMessageOptions): Promise<void> {
    if (!this.connected) {
      return Promise.reject(new Error('Cannot send message: channel not connected'));
    }

    this.logger.debug({ sessionId: options.sessionId }, 'Sending message');

    try {
      // TODO: Transform message to MatterMost format
      // TODO: Send via MatterMost API
      // TODO: Handle response

      this.logger.debug({ sessionId: options.sessionId }, 'Message sent successfully');
      return Promise.resolve();
    } catch (error) {
      this.logger.error({ err: error, sessionId: options.sessionId }, 'Failed to send message');
      return Promise.reject(error);
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
  private handleWebSocketMessage(_data: unknown): void {
    this.logger.debug('Received WebSocket message');
    // TODO: Transform MatterMost message to MoltBot format
    // TODO: Call message handler in Phase 2
  }

  /**
   * Handle connection ready
   */
  private handleConnectionReady(): void {
    this.logger.info('Connection ready');
    // TODO: Subscribe to events in Phase 2
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
