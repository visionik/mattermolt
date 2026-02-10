/**
 * Reaction handler for managing MatterMost reactions
 */

import type { Client4 } from '@mattermost/client';
import { Logger } from './logger.js';
import { SessionMapper } from './session-mapper.js';
import type { ReactionEvent } from './types.js';

/**
 * MatterMost reaction structure
 */
export interface MattermostReaction {
  user_id: string;
  post_id: string;
  emoji_name: string;
  create_at: number;
}

/**
 * MatterMost WebSocket reaction event
 */
export interface MattermostReactionEvent {
  event: 'reaction_added' | 'reaction_removed';
  data: {
    reaction?: string; // JSON string of MattermostReaction
  };
  broadcast?: {
    channel_id?: string;
    user_id?: string;
  };
}

/**
 * Reaction handler class
 */
export class ReactionHandler {
  private logger: Logger;
  private client: Client4;
  private sessionMapper: SessionMapper;
  private botUserId?: string;

  constructor(client: Client4, agentId = 'main') {
    this.client = client;
    this.sessionMapper = new SessionMapper(agentId);
    this.logger = new Logger({
      component: 'reaction-handler',
    });
  }

  /**
   * Set the bot user ID
   */
  setBotUserId(userId: string): void {
    this.botUserId = userId;
    this.logger.debug({ botUserId: userId }, 'Bot user ID set');
  }

  /**
   * Transform MatterMost reaction event to ReactionEvent
   */
  transformReactionEvent(wsEvent: MattermostReactionEvent): ReactionEvent | null {
    try {
      if (!wsEvent.data.reaction) {
        this.logger.warn('Reaction event missing reaction data');
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const reaction: MattermostReaction = JSON.parse(wsEvent.data.reaction);

      // Ignore reactions from the bot itself
      if (this.botUserId && reaction.user_id === this.botUserId) {
        this.logger.debug({ postId: reaction.post_id }, 'Ignoring bot reaction');
        return null;
      }

      const channelId = wsEvent.broadcast?.channel_id || '';

      // Determine session ID based on channel
      const sessionId = this.sessionMapper.mapChannelToSession(channelId);

      const reactionEvent: ReactionEvent = {
        sessionId,
        userId: reaction.user_id,
        postId: reaction.post_id,
        emoji: reaction.emoji_name,
        action: wsEvent.event === 'reaction_added' ? 'added' : 'removed',
        channelId,
        timestamp: new Date(reaction.create_at),
      };

      this.logger.debug(
        { postId: reaction.post_id, emoji: reaction.emoji_name, action: reactionEvent.action },
        'Transformed reaction event'
      );

      return reactionEvent;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to transform reaction event');
      return null;
    }
  }

  /**
   * Add a reaction to a post
   */
  async addReaction(postId: string, emojiName: string): Promise<void> {
    try {
      if (!this.botUserId) {
        throw new Error('Bot user ID not set');
      }

      // Create reaction via API (using addReaction method)
      await this.client.addReaction(this.botUserId, postId, emojiName);
      this.logger.debug({ postId, emoji: emojiName }, 'Added reaction');
    } catch (error) {
      this.logger.error({ err: error, postId, emoji: emojiName }, 'Failed to add reaction');
      throw error;
    }
  }

  /**
   * Remove a reaction from a post
   */
  async removeReaction(postId: string, emojiName: string): Promise<void> {
    try {
      if (!this.botUserId) {
        throw new Error('Bot user ID not set');
      }

      // Delete reaction via API
      await this.client.removeReaction(this.botUserId, postId, emojiName);
      this.logger.debug({ postId, emoji: emojiName }, 'Removed reaction');
    } catch (error) {
      this.logger.error({ err: error, postId, emoji: emojiName }, 'Failed to remove reaction');
      throw error;
    }
  }

  /**
   * Get reactions for a post
   */
  async getReactions(postId: string): Promise<MattermostReaction[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const reactions = await this.client.getReactionsForPost(postId);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return reactions;
    } catch (error) {
      this.logger.error({ err: error, postId }, 'Failed to get reactions');
      throw error;
    }
  }
}
