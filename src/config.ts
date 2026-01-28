/**
 * Configuration schema for MatterMolt channel adapter
 */

/**
 * DM access policy configuration
 */
export interface DmPolicyConfig {
  /** Access policy: 'open' allows all DMs, 'pairing' requires approval */
  policy?: 'open' | 'pairing';
}

/**
 * Channel-specific configuration
 */
export interface ChannelConfig {
  /** Whether the bot is allowed in this channel */
  allow?: boolean;
  /** Whether @mention is required to trigger bot in this channel */
  requireMention?: boolean;
}

/**
 * Team-specific configuration
 */
export interface TeamConfig {
  /** Map of channel names to channel configurations */
  channels?: Record<string, ChannelConfig>;
}

/**
 * Retry configuration for connection management
 */
export interface RetryConfig {
  /** Initial retry delay in milliseconds */
  initialDelay?: number;
  /** Maximum retry delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
  /** Maximum number of retry attempts (0 = infinite) */
  maxAttempts?: number;
  /** Whether to add jitter to retry delays */
  jitter?: boolean;
}

/**
 * Main MatterMost configuration
 */
export interface MattermostConfig {
  /** Whether the adapter is enabled */
  enabled: boolean;
  /** MatterMost server URL (e.g., https://mattermost.example.com) */
  url: string;
  /** Bot access token */
  token: string;
  /** DM access policy configuration */
  dm?: DmPolicyConfig;
  /** List of allowed user IDs or email patterns */
  allowFrom?: string[];
  /** Map of team IDs to team configurations */
  teams?: Record<string, TeamConfig>;
  /** Retry configuration for connection management */
  retry?: RetryConfig;
  /** Log level for the adapter */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Validation error class
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<MattermostConfig> = {
  enabled: true,
  dm: {
    policy: 'pairing',
  },
  retry: {
    initialDelay: 1000,
    maxDelay: 60000,
    multiplier: 2,
    maxAttempts: 0,
    jitter: true,
  },
  logLevel: 'info',
};

/**
 * Validates a MatterMost configuration object
 * @param config The configuration to validate
 * @returns The validated configuration with defaults applied
 * @throws ConfigValidationError if validation fails
 */
export function validateConfig(config: unknown): MattermostConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Configuration must be an object');
  }

  const cfg = config as Partial<MattermostConfig>;

  // Validate required fields
  if (typeof cfg.enabled !== 'boolean') {
    throw new ConfigValidationError('enabled must be a boolean');
  }

  if (!cfg.url || typeof cfg.url !== 'string') {
    throw new ConfigValidationError('url is required and must be a string');
  }

  // Validate URL format
  try {
    new URL(cfg.url);
  } catch {
    throw new ConfigValidationError('url must be a valid URL');
  }

  if (!cfg.token || typeof cfg.token !== 'string') {
    throw new ConfigValidationError('token is required and must be a string');
  }

  if (cfg.token.length < 10) {
    throw new ConfigValidationError('token appears to be invalid (too short)');
  }

  // Validate optional fields
  if (cfg.dm) {
    if (typeof cfg.dm !== 'object') {
      throw new ConfigValidationError('dm must be an object');
    }
    if (cfg.dm.policy && !['open', 'pairing'].includes(cfg.dm.policy)) {
      throw new ConfigValidationError("dm.policy must be 'open' or 'pairing'");
    }
  }

  if (cfg.allowFrom) {
    if (!Array.isArray(cfg.allowFrom)) {
      throw new ConfigValidationError('allowFrom must be an array');
    }
    if (!cfg.allowFrom.every((item) => typeof item === 'string')) {
      throw new ConfigValidationError('allowFrom must contain only strings');
    }
  }

  if (cfg.teams && typeof cfg.teams !== 'object') {
    throw new ConfigValidationError('teams must be an object');
  }

  if (cfg.retry) {
    if (typeof cfg.retry !== 'object') {
      throw new ConfigValidationError('retry must be an object');
    }
    const retry = cfg.retry;
    if (retry.initialDelay !== undefined && typeof retry.initialDelay !== 'number') {
      throw new ConfigValidationError('retry.initialDelay must be a number');
    }
    if (retry.maxDelay !== undefined && typeof retry.maxDelay !== 'number') {
      throw new ConfigValidationError('retry.maxDelay must be a number');
    }
    if (retry.multiplier !== undefined && typeof retry.multiplier !== 'number') {
      throw new ConfigValidationError('retry.multiplier must be a number');
    }
    if (retry.maxAttempts !== undefined && typeof retry.maxAttempts !== 'number') {
      throw new ConfigValidationError('retry.maxAttempts must be a number');
    }
    if (retry.jitter !== undefined && typeof retry.jitter !== 'boolean') {
      throw new ConfigValidationError('retry.jitter must be a boolean');
    }
  }

  if (cfg.logLevel && !['debug', 'info', 'warn', 'error'].includes(cfg.logLevel)) {
    throw new ConfigValidationError("logLevel must be 'debug', 'info', 'warn', or 'error'");
  }

  // Return validated config with defaults
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    dm: {
      ...DEFAULT_CONFIG.dm,
      ...cfg.dm,
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...cfg.retry,
    },
  } as MattermostConfig;
}
