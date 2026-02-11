/**
 * Presence handler for managing bot and user presence/status
 */

import type { Client4 } from '@mattermost/client';
import { Logger } from './logger.js';

/**
 * User status types
 */
export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

/**
 * Presence event
 */
export interface PresenceEvent {
  userId: string;
  status: UserStatus;
  timestamp: Date;
}

/**
 * Presence handler class
 */
export class PresenceHandler {
  private logger: Logger;
  private client: Client4;
  private botUserId?: string;
  private userStatuses: Map<string, UserStatus>;
  private currentBotStatus: UserStatus = 'online';

  constructor(client: Client4) {
    this.client = client;
    this.logger = new Logger({
      component: 'presence-handler',
    });
    this.userStatuses = new Map();
  }

  /**
   * Set the bot user ID
   */
  setBotUserId(userId: string): void {
    this.botUserId = userId;
    this.logger.debug({ botUserId: userId }, 'Bot user ID set');
  }

  /**
   * Set bot status
   */
  async setBotStatus(status: UserStatus): Promise<void> {
    try {
      if (!this.botUserId) {
        throw new Error('Bot user ID not set');
      }

      await this.client.updateStatus({ user_id: this.botUserId, status });
      this.currentBotStatus = status;
      this.logger.info({ status }, 'Bot status updated');
    } catch (error) {
      this.logger.error({ err: error, status }, 'Failed to update bot status');
      throw error;
    }
  }

  /**
   * Get current bot status
   */
  getCurrentBotStatus(): UserStatus {
    return this.currentBotStatus;
  }

  /**
   * Handle user status change event
   */
  handleStatusChange(userId: string, status: UserStatus): PresenceEvent {
    this.userStatuses.set(userId, status);

    this.logger.debug({ userId, status }, 'User status changed');

    return {
      userId,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Get user status
   */
  getUserStatus(userId: string): UserStatus | undefined {
    return this.userStatuses.get(userId);
  }

  /**
   * Fetch user status from API
   */
  async fetchUserStatus(userId: string): Promise<UserStatus> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const status = await this.client.getStatus(userId);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const statusValue = (status.status || 'offline') as UserStatus;
      this.userStatuses.set(userId, statusValue);
      return statusValue;
    } catch (error) {
      this.logger.error({ err: error, userId }, 'Failed to fetch user status');
      return 'offline';
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      botStatus: this.currentBotStatus,
      trackedUsers: this.userStatuses.size,
    };
  }

  /**
   * Clear all cached statuses
   */
  clear(): void {
    this.userStatuses.clear();
    this.logger.debug('Cleared user status cache');
  }
}
