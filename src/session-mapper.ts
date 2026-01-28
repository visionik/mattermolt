/**
 * Session mapper for MatterMost conversations to MoltBot sessions
 */

import { Logger } from './logger.js';

/**
 * Session mapper class
 * Maps MatterMost conversations (DMs, channels, threads) to MoltBot session IDs
 */
export class SessionMapper {
  private logger: Logger;
  private agentId: string;

  constructor(agentId = 'main') {
    this.agentId = agentId;
    this.logger = new Logger({
      component: 'session-mapper',
    });
  }

  /**
   * Map a DM conversation to session ID
   * Format: agent:main:main
   */
  mapDmToSession(): string {
    const sessionId = `agent:main:main`;
    this.logger.debug({ sessionId }, 'Mapped DM to session');
    return sessionId;
  }

  /**
   * Map a channel conversation to session ID
   * Format: agent:<agentId>:mattermost:channel:<channelId>
   */
  mapChannelToSession(channelId: string): string {
    const sessionId = `agent:${this.agentId}:mattermost:channel:${channelId}`;
    this.logger.debug({ sessionId, channelId }, 'Mapped channel to session');
    return sessionId;
  }

  /**
   * Map a thread conversation to session ID
   * Format: agent:<agentId>:mattermost:thread:<threadId>
   */
  mapThreadToSession(threadId: string): string {
    const sessionId = `agent:${this.agentId}:mattermost:thread:${threadId}`;
    this.logger.debug({ sessionId, threadId }, 'Mapped thread to session');
    return sessionId;
  }

  /**
   * Determine session ID from MatterMost post context
   */
  getSessionIdFromPost(post: {
    channel_type: string;
    channel_id: string;
    root_id?: string;
  }): string {
    // Check if it's a thread reply
    if (post.root_id) {
      return this.mapThreadToSession(post.root_id);
    }

    // Check if it's a DM
    if (post.channel_type === 'D') {
      return this.mapDmToSession();
    }

    // Otherwise it's a channel
    return this.mapChannelToSession(post.channel_id);
  }

  /**
   * Extract channel ID from session ID
   */
  extractChannelIdFromSession(sessionId: string): string | null {
    const channelMatch = sessionId.match(/mattermost:channel:(.+)$/);
    if (channelMatch) {
      return channelMatch[1];
    }
    return null;
  }

  /**
   * Extract thread ID from session ID
   */
  extractThreadIdFromSession(sessionId: string): string | null {
    const threadMatch = sessionId.match(/mattermost:thread:(.+)$/);
    if (threadMatch) {
      return threadMatch[1];
    }
    return null;
  }

  /**
   * Check if session ID represents a DM
   */
  isDmSession(sessionId: string): boolean {
    return sessionId === 'agent:main:main';
  }

  /**
   * Check if session ID represents a channel
   */
  isChannelSession(sessionId: string): boolean {
    return sessionId.includes('mattermost:channel:');
  }

  /**
   * Check if session ID represents a thread
   */
  isThreadSession(sessionId: string): boolean {
    return sessionId.includes('mattermost:thread:');
  }
}
