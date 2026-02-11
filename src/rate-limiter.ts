/**
 * Rate limiter with message queue for API requests
 */

import { Logger } from './logger.js';

/**
 * Queued request
 */
interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private logger: Logger;
  private queue: QueuedRequest<unknown>[];
  private processing: boolean;
  private requestsPerSecond: number;
  private burstSize: number;
  private tokens: number;
  private lastRefill: number;

  constructor(requestsPerSecond = 10, burstSize = 20) {
    this.logger = new Logger({
      component: 'rate-limiter',
    });
    this.queue = [];
    this.processing = false;
    this.requestsPerSecond = requestsPerSecond;
    this.burstSize = burstSize;
    this.tokens = burstSize;
    this.lastRefill = Date.now();
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      });

      if (!this.processing) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        void this.processQueue();
      }
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Refill tokens based on time elapsed
      this.refillTokens();

      // Wait if no tokens available
      if (this.tokens < 1) {
        const waitTime = Math.ceil((1 - this.tokens) * (1000 / this.requestsPerSecond));
        this.logger.debug(
          { waitTime, queueSize: this.queue.length },
          'Rate limit reached, waiting'
        );
        await this.sleep(waitTime);
        continue;
      }

      // Get next request
      const request = this.queue.shift();
      if (!request) {
        break;
      }

      // Consume a token
      this.tokens -= 1;

      // Execute request
      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        // Check if it's a 429 rate limit error
        if (this.isRateLimitError(error)) {
          this.logger.warn('Received 429 rate limit error from server');
          // Put request back in queue
          this.queue.unshift(request);
          // Wait before retrying
          await this.sleep(1000);
          continue;
        }

        request.reject(error as Error);
      }
    }

    this.processing = false;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.requestsPerSecond;

    this.tokens = Math.min(this.burstSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return err?.status_code === 429 || err?.statusCode === 429 || err?.status === 429;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      availableTokens: Math.floor(this.tokens),
      requestsPerSecond: this.requestsPerSecond,
      burstSize: this.burstSize,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.tokens = this.burstSize;
    this.logger.debug('Cleared rate limiter queue');
  }
}
