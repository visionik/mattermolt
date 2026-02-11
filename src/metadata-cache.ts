/**
 * Metadata cache for user and channel lookups
 */

import type { Client4 } from '@mattermost/client';
import { Logger } from './logger.js';

/**
 * User metadata
 */
export interface UserMetadata {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  lastFetch: Date;
}

/**
 * Channel metadata
 */
export interface ChannelMetadata {
  id: string;
  name: string;
  displayName: string;
  type: string;
  teamId: string;
  lastFetch: Date;
}

/**
 * Team metadata
 */
export interface TeamMetadata {
  id: string;
  name: string;
  displayName: string;
  lastFetch: Date;
}

/**
 * Metadata cache manager
 */
export class MetadataCache {
  private logger: Logger;
  private client: Client4;
  private users: Map<string, UserMetadata>;
  private channels: Map<string, ChannelMetadata>;
  private teams: Map<string, TeamMetadata>;
  private cacheExpiry: number; // milliseconds

  constructor(client: Client4, cacheExpiryMs = 3600000) {
    // 1 hour default
    this.client = client;
    this.logger = new Logger({
      component: 'metadata-cache',
    });
    this.users = new Map();
    this.channels = new Map();
    this.teams = new Map();
    this.cacheExpiry = cacheExpiryMs;
  }

  /**
   * Get user metadata (from cache or API)
   */
  async getUser(userId: string): Promise<UserMetadata | null> {
    // Check cache
    const cached = this.users.get(userId);
    if (cached && !this.isExpired(cached.lastFetch)) {
      return cached;
    }

    // Fetch from API
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const user = await this.client.getUser(userId);

      const metadata: UserMetadata = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: user.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        username: user.username,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: user.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        firstName: user.first_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lastName: user.last_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        nickname: user.nickname,
        lastFetch: new Date(),
      };

      this.users.set(userId, metadata);
      this.logger.debug({ userId, username: metadata.username }, 'Fetched user metadata');

      return metadata;
    } catch (error) {
      this.logger.error({ err: error, userId }, 'Failed to fetch user metadata');
      return null;
    }
  }

  /**
   * Get channel metadata (from cache or API)
   */
  async getChannel(channelId: string): Promise<ChannelMetadata | null> {
    // Check cache
    const cached = this.channels.get(channelId);
    if (cached && !this.isExpired(cached.lastFetch)) {
      return cached;
    }

    // Fetch from API
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const channel = await this.client.getChannel(channelId);

      const metadata: ChannelMetadata = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: channel.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        name: channel.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        displayName: channel.display_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        type: channel.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        teamId: channel.team_id,
        lastFetch: new Date(),
      };

      this.channels.set(channelId, metadata);
      this.logger.debug({ channelId, name: metadata.name }, 'Fetched channel metadata');

      return metadata;
    } catch (error) {
      this.logger.error({ err: error, channelId }, 'Failed to fetch channel metadata');
      return null;
    }
  }

  /**
   * Get team metadata (from cache or API)
   */
  async getTeam(teamId: string): Promise<TeamMetadata | null> {
    // Check cache
    const cached = this.teams.get(teamId);
    if (cached && !this.isExpired(cached.lastFetch)) {
      return cached;
    }

    // Fetch from API
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const team = await this.client.getTeam(teamId);

      const metadata: TeamMetadata = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: team.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        name: team.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        displayName: team.display_name,
        lastFetch: new Date(),
      };

      this.teams.set(teamId, metadata);
      this.logger.debug({ teamId, name: metadata.name }, 'Fetched team metadata');

      return metadata;
    } catch (error) {
      this.logger.error({ err: error, teamId }, 'Failed to fetch team metadata');
      return null;
    }
  }

  /**
   * Get all teams for the bot
   */
  async getMyTeams(): Promise<TeamMetadata[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const teams = await this.client.getMyTeams();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return teams.map((team: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: team.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        name: team.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        displayName: team.display_name,
        lastFetch: new Date(),
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to fetch teams');
      return [];
    }
  }

  /**
   * Get channels in a team
   */
  async getTeamChannels(teamId: string): Promise<ChannelMetadata[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const channels = await this.client.getMyChannels(teamId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return channels.map((channel: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: channel.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        name: channel.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        displayName: channel.display_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        type: channel.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        teamId: channel.team_id,
        lastFetch: new Date(),
      }));
    } catch (error) {
      this.logger.error({ err: error, teamId }, 'Failed to fetch team channels');
      return [];
    }
  }

  /**
   * Get channel members
   */
  async getChannelMembers(channelId: string): Promise<string[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const members = await this.client.getChannelMembers(channelId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return members.map((m: any) => m.user_id);
    } catch (error) {
      this.logger.error({ err: error, channelId }, 'Failed to fetch channel members');
      return [];
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(lastFetch: Date): boolean {
    const now = Date.now();
    const age = now - lastFetch.getTime();
    return age > this.cacheExpiry;
  }

  /**
   * Clear expired entries from all caches
   */
  clearExpired(): void {
    const now = Date.now();

    for (const [id, user] of this.users.entries()) {
      if (now - user.lastFetch.getTime() > this.cacheExpiry) {
        this.users.delete(id);
      }
    }

    for (const [id, channel] of this.channels.entries()) {
      if (now - channel.lastFetch.getTime() > this.cacheExpiry) {
        this.channels.delete(id);
      }
    }

    for (const [id, team] of this.teams.entries()) {
      if (now - team.lastFetch.getTime() > this.cacheExpiry) {
        this.teams.delete(id);
      }
    }

    this.logger.debug('Cleared expired cache entries');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      users: this.users.size,
      channels: this.channels.size,
      teams: this.teams.size,
      cacheExpiryMs: this.cacheExpiry,
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.users.clear();
    this.channels.clear();
    this.teams.clear();
    this.logger.debug('Cleared all caches');
  }
}
