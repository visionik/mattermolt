import { Logger } from './logger';
import { MattermostConfig } from './config';
import { randomBytes } from 'crypto';

export interface PairingRequest {
  userId: string;
  username: string;
  code: string;
  timestamp: Date;
  channelId: string;
}

export interface AccessContext {
  userId: string;
  username?: string;
  email?: string;
  channelId: string;
  channelType: 'D' | 'O' | 'P' | 'G'; // Direct, Open, Private, Group
  teamId?: string;
  isMention?: boolean;
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: string; requiresPairing?: boolean; pairingCode?: string };

export class AccessController {
  private readonly logger: Logger;
  private readonly config: MattermostConfig;
  private readonly pairedUsers: Set<string>;
  private readonly pendingPairings: Map<string, PairingRequest>;
  private readonly pairingCodes: Map<string, string>; // code -> userId

  constructor(logger: Logger, config: MattermostConfig) {
    this.logger = logger;
    this.config = config;
    this.pairedUsers = new Set();
    this.pendingPairings = new Map();
    this.pairingCodes = new Map();
  }

  /**
   * Check if a user is allowed to interact with the bot
   */
  checkAccess(context: AccessContext): AccessDecision {
    // 1. Check if it's a DM
    if (context.channelType === 'D') {
      return this.checkDMAccess(context);
    }

    // 2. Check if it's a channel/group
    return this.checkChannelAccess(context);
  }

  /**
   * Check DM access
   */
  private checkDMAccess(context: AccessContext): AccessDecision {
    const dmPolicy = this.config.dm?.policy || 'pairing';

    if (dmPolicy === 'open') {
      this.logger.debug(`DM access granted (open policy): ${context.userId}`);
      return { allowed: true };
    }

    // Pairing mode (default)
    if (this.pairedUsers.has(context.userId)) {
      this.logger.debug(`DM access granted (paired): ${context.userId}`);
      return { allowed: true };
    }

    // Check allowFrom list
    if (this.isUserAllowed(context)) {
      this.logger.debug(`DM access granted (allowFrom): ${context.userId}`);
      this.pairedUsers.add(context.userId); // Auto-pair allowed users
      return { allowed: true };
    }

    // Require pairing
    const pairingCode = this.generatePairingCode(
      context.userId,
      context.channelId,
      context.username
    );
    this.logger.info(`DM access denied, pairing required: ${context.userId}`);

    return {
      allowed: false,
      reason: 'DM pairing required',
      requiresPairing: true,
      pairingCode,
    };
  }

  /**
   * Check channel/group access
   */
  private checkChannelAccess(context: AccessContext): AccessDecision {
    const { channelId, teamId, isMention } = context;

    // Check if channel is explicitly configured
    if (teamId && this.config.teams?.[teamId]) {
      const teamConfig = this.config.teams[teamId];
      const channelConfig = teamConfig.channels?.[channelId];

      if (channelConfig) {
        // Channel explicitly configured
        if (!channelConfig.allow) {
          this.logger.debug(`Channel access denied (not allowed): ${channelId}`);
          return { allowed: false, reason: 'Bot not enabled in this channel' };
        }

        // Check if mention is required
        if (channelConfig.requireMention && !isMention) {
          this.logger.debug(`Channel access denied (mention required): ${channelId}`);
          return { allowed: false, reason: 'Bot mention required in this channel' };
        }

        this.logger.debug(`Channel access granted: ${channelId}`);
        return { allowed: true };
      }
    }

    // Check global group policy
    const groupPolicy = this.config.groupPolicy || 'allowlist';

    if (groupPolicy === 'open') {
      // Open mode - allow all channels
      this.logger.debug(`Channel access granted (open policy): ${channelId}`);
      return { allowed: true };
    }

    // Allowlist mode - deny by default
    this.logger.debug(`Channel access denied (not in allowlist): ${channelId}`);
    return { allowed: false, reason: 'Channel not in allowlist' };
  }

  /**
   * Check if user matches allowFrom patterns
   */
  private isUserAllowed(context: AccessContext): boolean {
    const allowFrom = this.config.allowFrom || [];
    if (allowFrom.length === 0) return false;

    for (const pattern of allowFrom) {
      // Exact user ID match
      if (pattern === context.userId) {
        return true;
      }

      // Email pattern match (if email provided)
      if (context.email && this.matchesPattern(context.email, pattern)) {
        return true;
      }

      // Username pattern match (if username provided)
      if (context.username && this.matchesPattern(context.username, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match string against pattern (supports wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(value);
    }

    return value.toLowerCase() === pattern.toLowerCase();
  }

  /**
   * Generate a pairing code for a user
   */
  private generatePairingCode(userId: string, channelId: string, username?: string): string {
    // Check if there's an existing pending pairing
    const existing = this.pendingPairings.get(userId);
    if (existing && Date.now() - existing.timestamp.getTime() < 5 * 60 * 1000) {
      // Reuse code if less than 5 minutes old
      return existing.code;
    }

    // Generate new 6-character code
    const code = randomBytes(3).toString('hex').toUpperCase();

    const request: PairingRequest = {
      userId,
      username: username || userId,
      code,
      timestamp: new Date(),
      channelId,
    };

    this.pendingPairings.set(userId, request);
    this.pairingCodes.set(code, userId);

    this.logger.info(`Generated pairing code ${code} for user ${userId}`);

    return code;
  }

  /**
   * Approve a pairing request
   */
  approvePairing(code: string): boolean {
    const userId = this.pairingCodes.get(code);
    if (!userId) {
      this.logger.warn(`Invalid pairing code: ${code}`);
      return false;
    }

    const request = this.pendingPairings.get(userId);
    if (!request) {
      this.logger.warn(`No pending pairing for code: ${code}`);
      return false;
    }

    // Check if code is expired (5 minutes)
    const age = Date.now() - request.timestamp.getTime();
    if (age > 5 * 60 * 1000) {
      this.logger.warn(`Expired pairing code: ${code}`);
      this.pendingPairings.delete(userId);
      this.pairingCodes.delete(code);
      return false;
    }

    // Approve pairing
    this.pairedUsers.add(userId);
    this.pendingPairings.delete(userId);
    this.pairingCodes.delete(code);

    this.logger.info(`Approved pairing for user ${userId} with code ${code}`);
    return true;
  }

  /**
   * Reject a pairing request
   */
  rejectPairing(code: string): boolean {
    const userId = this.pairingCodes.get(code);
    if (!userId) {
      this.logger.warn(`Invalid pairing code: ${code}`);
      return false;
    }

    this.pendingPairings.delete(userId);
    this.pairingCodes.delete(code);

    this.logger.info(`Rejected pairing for user ${userId} with code ${code}`);
    return true;
  }

  /**
   * Get pending pairing request by code
   */
  getPendingPairing(code: string): PairingRequest | undefined {
    const userId = this.pairingCodes.get(code);
    if (!userId) return undefined;
    return this.pendingPairings.get(userId);
  }

  /**
   * Get pending pairing request by user ID
   */
  getPendingPairingByUserId(userId: string): PairingRequest | undefined {
    return this.pendingPairings.get(userId);
  }

  /**
   * Check if user is paired
   */
  isPaired(userId: string): boolean {
    return this.pairedUsers.has(userId);
  }

  /**
   * Manually pair a user (for testing or admin actions)
   */
  pairUser(userId: string): void {
    this.pairedUsers.add(userId);
    this.logger.info(`Manually paired user ${userId}`);
  }

  /**
   * Unpair a user
   */
  unpairUser(userId: string): void {
    this.pairedUsers.delete(userId);
    this.pendingPairings.delete(userId);
    this.logger.info(`Unpaired user ${userId}`);
  }

  /**
   * Clean up expired pairing requests
   */
  cleanupExpiredPairings(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, request] of this.pendingPairings.entries()) {
      const age = now - request.timestamp.getTime();
      if (age > 5 * 60 * 1000) {
        this.pendingPairings.delete(userId);
        this.pairingCodes.delete(request.code);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired pairing requests`);
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    pairedUsers: number;
    pendingPairings: number;
  } {
    return {
      pairedUsers: this.pairedUsers.size,
      pendingPairings: this.pendingPairings.size,
    };
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  sanitizeInput(input: string, maxLength: number = 4000): string {
    // Trim whitespace
    let sanitized = input.trim();

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    return sanitized;
  }

  /**
   * Validate message content for security
   */
  validateMessage(content: string): { valid: boolean; reason?: string } {
    // Check for excessively long messages
    if (content.length > 16000) {
      return { valid: false, reason: 'Message exceeds maximum length' };
    }

    // Check for null bytes
    if (content.includes('\0')) {
      return { valid: false, reason: 'Invalid characters in message' };
    }

    // Check for control characters (except newlines, tabs)
    // eslint-disable-next-line no-control-regex
    const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content);
    if (hasInvalidChars) {
      return { valid: false, reason: 'Invalid control characters in message' };
    }

    return { valid: true };
  }
}
