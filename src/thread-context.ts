/**
 * Thread context manager for maintaining thread state
 */

import { Logger } from './logger.js';

/**
 * Thread context information
 */
export interface ThreadContext {
  /** Root post ID */
  rootId: string;
  /** Channel ID */
  channelId: string;
  /** Participant user IDs */
  participants: Set<string>;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Thread subject/first message */
  subject?: string;
}

/**
 * Thread context manager
 */
export class ThreadContextManager {
  private logger: Logger;
  private contexts: Map<string, ThreadContext>;
  private maxContexts: number;

  constructor(maxContexts = 1000) {
    this.logger = new Logger({
      component: 'thread-context',
    });
    this.contexts = new Map();
    this.maxContexts = maxContexts;
  }

  /**
   * Get or create thread context
   */
  getOrCreateContext(rootId: string, channelId: string): ThreadContext {
    let context = this.contexts.get(rootId);

    if (!context) {
      context = {
        rootId,
        channelId,
        participants: new Set(),
        lastActivity: new Date(),
      };
      this.contexts.set(rootId, context);

      // Cleanup old contexts if we exceed the limit
      if (this.contexts.size > this.maxContexts) {
        this.cleanupOldContexts();
      }

      this.logger.debug({ rootId, channelId }, 'Created thread context');
    }

    return context;
  }

  /**
   * Update thread context with new activity
   */
  updateContext(rootId: string, userId: string, message?: string): void {
    const context = this.contexts.get(rootId);

    if (!context) {
      return;
    }

    context.participants.add(userId);
    context.lastActivity = new Date();

    // Set subject from first message if not set
    if (!context.subject && message) {
      context.subject = message.substring(0, 100);
    }

    this.logger.debug(
      { rootId, participants: context.participants.size },
      'Updated thread context'
    );
  }

  /**
   * Get thread context
   */
  getContext(rootId: string): ThreadContext | undefined {
    return this.contexts.get(rootId);
  }

  /**
   * Check if thread exists
   */
  hasThread(rootId: string): boolean {
    return this.contexts.has(rootId);
  }

  /**
   * Get thread participant count
   */
  getParticipantCount(rootId: string): number {
    const context = this.contexts.get(rootId);
    return context ? context.participants.size : 0;
  }

  /**
   * Remove thread context
   */
  removeContext(rootId: string): void {
    this.contexts.delete(rootId);
    this.logger.debug({ rootId }, 'Removed thread context');
  }

  /**
   * Cleanup old contexts (LRU eviction)
   */
  private cleanupOldContexts(): void {
    // Sort by last activity and remove oldest 10%
    const sorted = Array.from(this.contexts.entries()).sort(
      ([, a], [, b]) => a.lastActivity.getTime() - b.lastActivity.getTime()
    );

    const toRemove = Math.floor(this.maxContexts * 0.1);

    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.contexts.delete(sorted[i][0]);
    }

    this.logger.debug(
      { removed: toRemove, remaining: this.contexts.size },
      'Cleaned up old thread contexts'
    );
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalThreads: this.contexts.size,
      maxContexts: this.maxContexts,
    };
  }

  /**
   * Clear all contexts
   */
  clear(): void {
    this.contexts.clear();
    this.logger.debug('Cleared all thread contexts');
  }
}
