/**
 * MatterMost channel adapter for MoltBot Gateway
 */

import { Logger } from './logger.js';
import type { MattermostConfig } from './config.js';
import { ConnectionState } from './types.js';
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

  constructor(config: MattermostConfig, eventHandlers: ChannelEventHandlers = {}) {
    this.eventHandlers = eventHandlers;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.logger = new Logger({
      level: config.logLevel,
      component: 'mattermost-channel',
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
  start(): Promise<void> {
    if (this.connectionState !== ConnectionState.DISCONNECTED) {
      this.logger.warn('Channel already starting or started');
      return Promise.resolve();
    }

    this.logger.info('Starting MatterMost channel adapter');

    try {
      this.setConnectionState(ConnectionState.CONNECTING);

      // TODO: Initialize ConnectionManager
      // TODO: Establish WebSocket connection
      // TODO: Subscribe to events

      this.setConnectionState(ConnectionState.CONNECTED);
      this.logger.info('MatterMost channel adapter started successfully');
      return Promise.resolve();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to start channel adapter');
      this.setConnectionState(ConnectionState.FAILED);
      return Promise.reject(error);
    }
  }

  /**
   * Stop the channel adapter
   * Closes connection to MatterMost server
   */
  stop(): Promise<void> {
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      this.logger.warn('Channel already stopped');
      return Promise.resolve();
    }

    this.logger.info('Stopping MatterMost channel adapter');

    try {
      // TODO: Unsubscribe from events
      // TODO: Close WebSocket connection
      // TODO: Cleanup resources

      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.logger.info('MatterMost channel adapter stopped successfully');
      return Promise.resolve();
    } catch (error) {
      this.logger.error({ err: error }, 'Error stopping channel adapter');
      return Promise.reject(error);
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

  // TODO: Uncomment when implementing message handlers
  // /**
  //  * Handle incoming message from MatterMost
  //  * @param _event Message event
  //  */
  // private async handleMessage(_event: unknown): Promise<void> {
  //   try {
  //     // TODO: Transform MatterMost message to MoltBot format
  //     // TODO: Call message handler
  //
  //     if (this.eventHandlers.onMessage) {
  //       // await this.eventHandlers.onMessage(transformedEvent);
  //     }
  //   } catch (error) {
  //     this.logger.error({ err: error }, 'Error handling message');
  //     if (this.eventHandlers.onError) {
  //       this.eventHandlers.onError(error as Error);
  //     }
  //   }
  // }
  //
  // /**
  //  * Handle errors
  //  * @param error Error object
  //  */
  // private handleError(error: Error): void {
  //   this.logger.error({ err: error }, 'Channel error');
  //
  //   if (this.eventHandlers.onError) {
  //     try {
  //       this.eventHandlers.onError(error);
  //     } catch (handlerError) {
  //       this.logger.error({ err: handlerError }, 'Error in error handler');
  //     }
  //   }
  // }
}
