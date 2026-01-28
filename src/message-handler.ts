/**
 * Message handler for transforming messages between MatterMost and MoltBot formats
 */

import type { Client4 } from '@mattermost/client';
import { Logger } from './logger.js';
import { SessionMapper } from './session-mapper.js';
import type { MessageEvent, MessageContent } from './types.js';

/**
 * MatterMost post structure
 */
export interface MattermostPost {
  id: string;
  create_at: number;
  update_at: number;
  delete_at: number;
  user_id: string;
  channel_id: string;
  root_id?: string;
  message: string;
  type: string;
  props?: Record<string, unknown>;
  hashtags?: string;
  file_ids?: string[];
  channel_type?: string;
}

/**
 * MatterMost WebSocket event
 */
export interface MattermostWebSocketEvent {
  event: string;
  data: {
    post?: string;
    channel_type?: string;
    [key: string]: unknown;
  };
  broadcast?: {
    channel_id?: string;
    team_id?: string;
    user_id?: string;
  };
  seq?: number;
}

/**
 * Message handler class
 */
export class MessageHandler {
  private logger: Logger;
  private sessionMapper: SessionMapper;
  private client: Client4;
  private botUserId?: string;

  constructor(client: Client4, agentId = 'main') {
    this.client = client;
    this.sessionMapper = new SessionMapper(agentId);
    this.logger = new Logger({
      component: 'message-handler',
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
   * Transform MatterMost WebSocket event to MoltBot message event
   */
  transformInboundMessage(wsEvent: MattermostWebSocketEvent): Promise<MessageEvent | null> {
    try {
      // Only process 'posted' events
      if (wsEvent.event !== 'posted') {
        return Promise.resolve(null);
      }

      // Parse the post data
      if (!wsEvent.data.post) {
        this.logger.warn('WebSocket event missing post data');
        return Promise.resolve(null);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const post: MattermostPost = JSON.parse(wsEvent.data.post);

      // Ignore messages from the bot itself
      if (this.botUserId && post.user_id === this.botUserId) {
        this.logger.debug({ postId: post.id }, 'Ignoring bot message');
        return Promise.resolve(null);
      }

      // Ignore system messages
      if (post.type && post.type !== '') {
        this.logger.debug({ postId: post.id, type: post.type }, 'Ignoring system message');
        return Promise.resolve(null);
      }

      // Get channel type
      const channelType = wsEvent.data.channel_type || post.channel_type || 'O';

      // Determine session ID
      const sessionId = this.sessionMapper.getSessionIdFromPost({
        channel_type: channelType,
        channel_id: post.channel_id,
        root_id: post.root_id,
      });

      // Transform to MoltBot message event
      const messageEvent: MessageEvent = {
        sessionId,
        userId: post.user_id,
        content: {
          text: post.message,
          metadata: {
            postId: post.id,
            channelId: post.channel_id,
            rootId: post.root_id,
            channelType,
          },
        },
        timestamp: new Date(post.create_at),
        channelId: post.channel_id,
        threadId: post.root_id,
        correlationId: post.id,
      };

      this.logger.debug(
        { sessionId, userId: post.user_id, postId: post.id },
        'Transformed inbound message'
      );

      return Promise.resolve(messageEvent);
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to transform inbound message');
      return Promise.resolve(null);
    }
  }

  /**
   * Transform MoltBot message content to MatterMost format and send
   */
  async sendMessage(
    sessionId: string,
    content: MessageContent,
    options?: {
      replyTo?: string;
      threadId?: string;
    }
  ): Promise<void> {
    try {
      // Determine channel and thread from session ID
      let channelId: string | null = null;
      let rootId: string | undefined = options?.threadId;

      if (this.sessionMapper.isThreadSession(sessionId)) {
        rootId = this.sessionMapper.extractThreadIdFromSession(sessionId) || undefined;
        // Need to get channel ID from the thread's root post
        if (rootId) {
          const rootPost = await this.client.getPost(rootId);
          channelId = rootPost.channel_id;
        }
      } else if (this.sessionMapper.isChannelSession(sessionId)) {
        channelId = this.sessionMapper.extractChannelIdFromSession(sessionId);
      } else if (this.sessionMapper.isDmSession(sessionId)) {
        // For DMs, we need to get the channel ID from metadata or context
        // This would typically come from the inbound message
        throw new Error('DM channel ID not available - need to track from inbound message');
      }

      if (!channelId) {
        throw new Error(`Cannot determine channel ID from session: ${sessionId}`);
      }

      // Handle message chunking for long messages (MatterMost limit is 4000 chars)
      const chunks = this.chunkMessage(content.text, 4000);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;

        const post = {
          channel_id: channelId,
          message: chunk,
          root_id: rootId,
          // Only attach files on the last chunk
          file_ids: isLastChunk && content.files ? [] : undefined,
        };

        await this.client.createPost(post);
        this.logger.debug(
          { channelId, rootId, chunk: i + 1, total: chunks.length },
          'Sent message chunk'
        );
      }

      this.logger.info({ sessionId, channelId, chunks: chunks.length }, 'Message sent');
    } catch (error) {
      this.logger.error({ err: error, sessionId }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(sessionId: string): Promise<void> {
    try {
      let channelId: string | null = null;

      if (this.sessionMapper.isChannelSession(sessionId)) {
        channelId = this.sessionMapper.extractChannelIdFromSession(sessionId);
      } else if (this.sessionMapper.isThreadSession(sessionId)) {
        const threadId = this.sessionMapper.extractThreadIdFromSession(sessionId);
        if (threadId) {
          const rootPost = await this.client.getPost(threadId);
          channelId = rootPost.channel_id;
        }
      }

      if (channelId) {
        // MatterMost typing indicator would typically be sent via WebSocket
        // For now, we'll just log it
        this.logger.debug({ sessionId, channelId }, 'Typing indicator requested');
      }
    } catch (error) {
      this.logger.error({ err: error, sessionId }, 'Failed to send typing indicator');
    }
  }

  /**
   * Edit a message
   */
  async editMessage(postId: string, newText: string): Promise<void> {
    try {
      const post = await this.client.getPost(postId);
      const updatedPost = {
        ...post,
        message: newText,
      };

      await this.client.updatePost(updatedPost);
      this.logger.info({ postId }, 'Message edited');
    } catch (error) {
      this.logger.error({ err: error, postId }, 'Failed to edit message');
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(postId: string): Promise<void> {
    try {
      await this.client.deletePost(postId);
      this.logger.info({ postId }, 'Message deleted');
    } catch (error) {
      this.logger.error({ err: error, postId }, 'Failed to delete message');
      throw error;
    }
  }

  /**
   * Chunk a message into smaller pieces
   */
  private chunkMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a natural boundary (newline, space)
      let splitIndex = maxLength;
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);

      if (lastNewline > maxLength * 0.8) {
        splitIndex = lastNewline + 1;
      } else if (lastSpace > maxLength * 0.8) {
        splitIndex = lastSpace + 1;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex);
    }

    return chunks;
  }
}
