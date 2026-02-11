/**
 * Connection manager for MatterMost WebSocket and API client
 */

import { Client4 } from '@mattermost/client';
import WebSocket from 'ws';
import { Logger } from './logger.js';
import { ConnectionState } from './types.js';
import type { MattermostConfig } from './config.js';

/**
 * Connection event types
 */
export interface ConnectionEvents {
  /** Connection state changed */
  stateChange: (state: ConnectionState) => void;
  /** WebSocket message received */
  message: (data: unknown) => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** Connection ready */
  ready: () => void;
}

/**
 * Manages MatterMost client connection and WebSocket
 */
export class ConnectionManager {
  private config: MattermostConfig;
  private logger: Logger;
  private client: Client4;
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  private eventHandlers: Partial<ConnectionEvents> = {};

  constructor(config: MattermostConfig, eventHandlers: Partial<ConnectionEvents> = {}) {
    this.config = config;
    this.eventHandlers = eventHandlers;
    this.logger = new Logger({
      level: config.logLevel,
      component: 'connection-manager',
    });

    // Initialize MatterMost API client
    this.client = new Client4();
    this.client.setUrl(config.url);
    this.client.setToken(config.token);
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Get MatterMost API client
   */
  get apiClient(): Client4 {
    return this.client;
  }

  /**
   * Get WebSocket instance (for advanced operations)
   */
  get webSocket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Send a WebSocket action
   * @param action The action to send
   * @param data Data for the action
   */
  sendWebSocketAction(action: string, data: Record<string, unknown>): void {
    if (!this.ws || this.state !== ConnectionState.CONNECTED) {
      this.logger.debug({ action }, 'Cannot send WebSocket action: not connected');
      return;
    }

    const message = {
      action,
      seq: Date.now(),
      data,
    };

    try {
      this.ws.send(JSON.stringify(message));
      this.logger.debug({ action }, 'Sent WebSocket action');
    } catch (error) {
      this.logger.error({ err: error, action }, 'Failed to send WebSocket action');
    }
  }

  /**
   * Connect to MatterMost server
   */
  async connect(): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      this.logger.warn({ state: this.state }, 'Connection already active or in progress');
      return;
    }

    this.logger.info('Connecting to MatterMost server');
    this.setState(ConnectionState.CONNECTING);

    try {
      // Verify authentication
      await this.verifyAuth();

      // Establish WebSocket connection
      await this.connectWebSocket();

      this.reconnectAttempt = 0;
      this.setState(ConnectionState.CONNECTED);
      this.logger.info('Successfully connected to MatterMost');

      // Notify ready
      if (this.eventHandlers.ready) {
        this.eventHandlers.ready();
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to connect to MatterMost');
      this.setState(ConnectionState.FAILED);
      throw error;
    }
  }

  /**
   * Disconnect from MatterMost server
   */
  disconnect(): Promise<void> {
    this.logger.info('Disconnecting from MatterMost server');

    // Clear timers
    this.clearReconnectTimer();
    this.clearPingTimer();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.logger.info('Disconnected from MatterMost');
    return Promise.resolve();
  }

  /**
   * Verify authentication with MatterMost server
   */
  private async verifyAuth(): Promise<void> {
    this.logger.debug('Verifying bot authentication');

    try {
      // Get current user (bot)
      const user = await this.client.getMe();
      this.logger.info({ userId: user.id, username: user.username }, 'Bot authenticated');
    } catch (error) {
      this.logger.error({ err: error }, 'Authentication failed');
      throw new Error('Failed to authenticate with MatterMost server');
    }
  }

  /**
   * Establish WebSocket connection
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Construct WebSocket URL
        const wsUrl = this.config.url.replace(/^http/, 'ws') + '/api/v4/websocket';

        this.logger.debug({ wsUrl }, 'Connecting to WebSocket');

        // Create WebSocket connection
        this.ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
          },
        });

        // Handle connection open
        this.ws.on('open', () => {
          this.logger.info('WebSocket connected');
          this.startHealthMonitoring();
          resolve();
        });

        // Handle incoming messages
        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleWebSocketMessage(data);
        });

        // Handle connection close
        this.ws.on('close', (code: number, reason: Buffer) => {
          this.logger.warn({ code, reason: reason.toString() }, 'WebSocket closed');
          this.handleWebSocketClose();
        });

        // Handle errors
        this.ws.on('error', (error: Error) => {
          this.logger.error({ err: error }, 'WebSocket error');
          if (this.eventHandlers.error) {
            this.eventHandlers.error(error);
          }
          reject(error);
        });

        // Handle pong responses
        this.ws.on('pong', () => {
          this.lastPongTime = Date.now();
          this.logger.debug('Received pong from server');
        });
      } catch (error) {
        this.logger.error({ err: error }, 'Failed to create WebSocket');
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(data: WebSocket.Data): void {
    try {
      // Convert data to string - WebSocket.Data can be string | Buffer | ArrayBuffer | Buffer[]
      let dataStr: string;
      if (typeof data === 'string') {
        dataStr = data;
      } else if (Buffer.isBuffer(data)) {
        dataStr = data.toString('utf8');
      } else if (Array.isArray(data)) {
        dataStr = Buffer.concat(data).toString('utf8');
      } else {
        dataStr = Buffer.from(data).toString('utf8');
      }

      const message = JSON.parse(dataStr) as unknown;
      this.logger.debug({ message }, 'Received WebSocket message');

      if (this.eventHandlers.message) {
        this.eventHandlers.message(message);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to parse WebSocket message');
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(): void {
    if (this.state === ConnectionState.DISCONNECTED) {
      // Intentional disconnect, don't reconnect
      return;
    }

    this.logger.info('WebSocket connection lost, will attempt to reconnect');
    this.setState(ConnectionState.RECONNECTING);
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const {
      initialDelay = 1000,
      maxDelay = 60000,
      multiplier = 2,
      jitter = true,
    } = this.config.retry || {};

    // Calculate delay with exponential backoff
    let delay = Math.min(initialDelay * Math.pow(multiplier, this.reconnectAttempt), maxDelay);

    // Add jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    this.logger.info(
      { attempt: this.reconnectAttempt + 1, delayMs: Math.round(delay) },
      'Scheduling reconnection attempt'
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      void this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    try {
      this.logger.info({ attempt: this.reconnectAttempt }, 'Attempting to reconnect');

      await this.connectWebSocket();

      this.reconnectAttempt = 0;
      this.setState(ConnectionState.CONNECTED);
      this.logger.info('Successfully reconnected');

      if (this.eventHandlers.ready) {
        this.eventHandlers.ready();
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Reconnection attempt failed');

      const { maxAttempts = 0 } = this.config.retry || {};
      if (maxAttempts > 0 && this.reconnectAttempt >= maxAttempts) {
        this.logger.error('Maximum reconnection attempts reached');
        this.setState(ConnectionState.FAILED);
        if (this.eventHandlers.error) {
          this.eventHandlers.error(new Error('Failed to reconnect after maximum attempts'));
        }
      } else {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Start health monitoring (ping/pong)
   */
  private startHealthMonitoring(): void {
    this.clearPingTimer();
    this.lastPongTime = Date.now();

    const pingInterval = 30000; // 30 seconds
    const pongTimeout = 10000; // 10 seconds

    this.pingTimer = setInterval(() => {
      if (!this.ws) {
        return;
      }

      // Check if last pong is too old
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > pingInterval + pongTimeout) {
        this.logger.warn({ timeSinceLastPong }, 'Connection appears stale, reconnecting');
        this.handleWebSocketClose();
        return;
      }

      // Send ping
      this.logger.debug('Sending ping to server');
      this.ws.ping();
    }, pingInterval);
  }

  /**
   * Set connection state and notify handlers
   */
  private setState(state: ConnectionState): void {
    const previousState = this.state;
    this.state = state;

    if (previousState !== state) {
      this.logger.debug({ from: previousState, to: state }, 'Connection state changed');

      if (this.eventHandlers.stateChange) {
        this.eventHandlers.stateChange(state);
      }
    }
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clear ping timer
   */
  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
