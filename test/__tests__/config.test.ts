/**
 * Unit tests for configuration validation
 */

import { validateConfig, ConfigValidationError, DEFAULT_CONFIG } from '../../src/config';

describe('Configuration Validation', () => {
  describe('validateConfig', () => {
    it('should accept valid minimal config', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
      };

      const result = validateConfig(config);

      expect(result.enabled).toBe(true);
      expect(result.url).toBe('https://mattermost.example.com');
      expect(result.token).toBe('test-token-123456789');
    });

    it('should apply default values', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
      };

      const result = validateConfig(config);

      expect(result.dm?.policy).toBe('pairing');
      expect(result.retry?.initialDelay).toBe(1000);
      expect(result.retry?.maxDelay).toBe(60000);
      expect(result.retry?.multiplier).toBe(2);
      expect(result.retry?.jitter).toBe(true);
      expect(result.logLevel).toBe('info');
    });

    it('should accept valid full config', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        dm: { policy: 'open' as const },
        allowFrom: ['user1@example.com', 'user2@example.com'],
        teams: {
          'team-123': {
            channels: {
              general: { allow: true, requireMention: true },
            },
          },
        },
        retry: {
          initialDelay: 2000,
          maxDelay: 120000,
          multiplier: 3,
          maxAttempts: 5,
          jitter: false,
        },
        logLevel: 'debug' as const,
      };

      const result = validateConfig(config);

      expect(result.dm?.policy).toBe('open');
      expect(result.allowFrom).toEqual(['user1@example.com', 'user2@example.com']);
      expect(result.retry?.initialDelay).toBe(2000);
      expect(result.logLevel).toBe('debug');
    });

    it('should throw on non-object config', () => {
      expect(() => validateConfig(null)).toThrow(ConfigValidationError);
      expect(() => validateConfig(undefined)).toThrow(ConfigValidationError);
      expect(() => validateConfig('string')).toThrow(ConfigValidationError);
      expect(() => validateConfig(123)).toThrow(ConfigValidationError);
    });

    it('should throw on missing enabled field', () => {
      const config = {
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
      };

      expect(() => validateConfig(config)).toThrow('enabled must be a boolean');
    });

    it('should throw on invalid enabled type', () => {
      const config = {
        enabled: 'true',
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
      };

      expect(() => validateConfig(config)).toThrow('enabled must be a boolean');
    });

    it('should throw on missing url', () => {
      const config = {
        enabled: true,
        token: 'test-token-123456789',
      };

      expect(() => validateConfig(config)).toThrow('url is required and must be a string');
    });

    it('should throw on invalid url type', () => {
      const config = {
        enabled: true,
        url: 123,
        token: 'test-token-123456789',
      };

      expect(() => validateConfig(config)).toThrow('url is required and must be a string');
    });

    it('should throw on malformed url', () => {
      const config = {
        enabled: true,
        url: 'not-a-valid-url',
        token: 'test-token-123456789',
      };

      expect(() => validateConfig(config)).toThrow('url must be a valid URL');
    });

    it('should throw on missing token', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
      };

      expect(() => validateConfig(config)).toThrow('token is required and must be a string');
    });

    it('should throw on invalid token type', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 123,
      };

      expect(() => validateConfig(config)).toThrow('token is required and must be a string');
    });

    it('should throw on token too short', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'short',
      };

      expect(() => validateConfig(config)).toThrow('token appears to be invalid (too short)');
    });

    it('should throw on invalid dm policy', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        dm: { policy: 'invalid' },
      };

      expect(() => validateConfig(config)).toThrow("dm.policy must be 'open' or 'pairing'");
    });

    it('should throw on invalid dm type', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        dm: 'invalid',
      };

      expect(() => validateConfig(config)).toThrow('dm must be an object');
    });

    it('should throw on invalid allowFrom type', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        allowFrom: 'not-an-array',
      };

      expect(() => validateConfig(config)).toThrow('allowFrom must be an array');
    });

    it('should throw on non-string allowFrom items', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        allowFrom: ['valid@example.com', 123],
      };

      expect(() => validateConfig(config)).toThrow('allowFrom must contain only strings');
    });

    it('should throw on invalid teams type', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        teams: 'invalid',
      };

      expect(() => validateConfig(config)).toThrow('teams must be an object');
    });

    it('should throw on invalid retry type', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: 'invalid',
      };

      expect(() => validateConfig(config)).toThrow('retry must be an object');
    });

    it('should throw on invalid retry.initialDelay', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: { initialDelay: 'not-a-number' },
      };

      expect(() => validateConfig(config)).toThrow('retry.initialDelay must be a number');
    });

    it('should throw on invalid retry.maxDelay', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: { maxDelay: 'not-a-number' },
      };

      expect(() => validateConfig(config)).toThrow('retry.maxDelay must be a number');
    });

    it('should throw on invalid retry.multiplier', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: { multiplier: 'not-a-number' },
      };

      expect(() => validateConfig(config)).toThrow('retry.multiplier must be a number');
    });

    it('should throw on invalid retry.maxAttempts', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: { maxAttempts: 'not-a-number' },
      };

      expect(() => validateConfig(config)).toThrow('retry.maxAttempts must be a number');
    });

    it('should throw on invalid retry.jitter', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        retry: { jitter: 'not-a-boolean' },
      };

      expect(() => validateConfig(config)).toThrow('retry.jitter must be a boolean');
    });

    it('should throw on invalid logLevel', () => {
      const config = {
        enabled: true,
        url: 'https://mattermost.example.com',
        token: 'test-token-123456789',
        logLevel: 'invalid',
      };

      expect(() => validateConfig(config)).toThrow(
        "logLevel must be 'debug', 'info', 'warn', or 'error'"
      );
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CONFIG.dm?.policy).toBe('pairing');
      expect(DEFAULT_CONFIG.retry?.initialDelay).toBe(1000);
      expect(DEFAULT_CONFIG.retry?.maxDelay).toBe(60000);
      expect(DEFAULT_CONFIG.retry?.multiplier).toBe(2);
      expect(DEFAULT_CONFIG.retry?.maxAttempts).toBe(0);
      expect(DEFAULT_CONFIG.retry?.jitter).toBe(true);
      expect(DEFAULT_CONFIG.logLevel).toBe('info');
    });
  });
});
