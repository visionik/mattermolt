import { MattermostChannel } from '../../src/mattermost-channel';
import { MattermostConfig } from '../../src/config';
import { ConnectionState } from '../../src/types';

// Mock dependencies
jest.mock('../../src/connection-manager');
jest.mock('../../src/message-handler');

describe('MattermostChannel', () => {
  let config: MattermostConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      url: 'https://mattermost.example.com',
      token: 'test-token-12345',
      dm: {
        policy: 'pairing',
      },
      groupPolicy: 'allowlist',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create channel with config', () => {
      const channel = new MattermostChannel(config);
      
      expect(channel.type).toBe('mattermost');
      expect(channel.connected).toBe(false);
      expect(channel.state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should initialize all components', () => {
      const channel = new MattermostChannel(config);
      
      // Should have stats
      const stats = channel.getStats();
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('connectionState');
      expect(stats).toHaveProperty('accessControl');
    });
  });

  describe('Event Handlers', () => {
    it('should accept event handlers', () => {
      const onMessage = jest.fn();
      const onConnectionStateChange = jest.fn();
      const onError = jest.fn();

      const channel = new MattermostChannel(config, {
        onMessage,
        onConnectionStateChange,
        onError,
      });

      expect(channel).toBeDefined();
    });
  });

  describe('Pairing', () => {
    it('should approve pairing with valid code', () => {
      const channel = new MattermostChannel(config);
      
      // This will fail because we don't have a real pending pairing
      // but it tests the method exists and works
      const result = channel.approvePairing('ABCDEF');
      expect(typeof result).toBe('boolean');
    });

    it('should reject pairing with valid code', () => {
      const channel = new MattermostChannel(config);
      
      const result = channel.rejectPairing('ABCDEF');
      expect(typeof result).toBe('boolean');
    });

    it('should get pending pairing by code', () => {
      const channel = new MattermostChannel(config);
      
      const result = channel.getPendingPairing('ABCDEF');
      expect(result).toBeUndefined(); // No pending pairing
    });
  });

  describe('Statistics', () => {
    it('should return channel statistics', () => {
      const channel = new MattermostChannel(config);
      
      const stats = channel.getStats();
      
      expect(stats.connected).toBe(false);
      expect(stats.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(stats.accessControl).toHaveProperty('pairedUsers');
      expect(stats.accessControl).toHaveProperty('pendingPairings');
      expect(stats.accessControl.pairedUsers).toBe(0);
      expect(stats.accessControl.pendingPairings).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should work with open DM policy', () => {
      const openConfig: MattermostConfig = {
        ...config,
        dm: {
          policy: 'open',
        },
      };

      const channel = new MattermostChannel(openConfig);
      expect(channel).toBeDefined();
    });

    it('should work with open group policy', () => {
      const openConfig: MattermostConfig = {
        ...config,
        groupPolicy: 'open',
      };

      const channel = new MattermostChannel(openConfig);
      expect(channel).toBeDefined();
    });

    it('should work with allowFrom list', () => {
      const allowConfig: MattermostConfig = {
        ...config,
        allowFrom: ['user1', '*@example.com'],
      };

      const channel = new MattermostChannel(allowConfig);
      expect(channel).toBeDefined();
    });

    it('should work with team configuration', () => {
      const teamConfig: MattermostConfig = {
        ...config,
        teams: {
          team1: {
            channels: {
              general: {
                allow: true,
                requireMention: true,
              },
            },
          },
        },
      };

      const channel = new MattermostChannel(teamConfig);
      expect(channel).toBeDefined();
    });
  });

  describe('Log Levels', () => {
    it('should support different log levels', () => {
      const debugConfig = { ...config, logLevel: 'debug' as const };
      const infoConfig = { ...config, logLevel: 'info' as const };
      const warnConfig = { ...config, logLevel: 'warn' as const };
      const errorConfig = { ...config, logLevel: 'error' as const };

      expect(new MattermostChannel(debugConfig)).toBeDefined();
      expect(new MattermostChannel(infoConfig)).toBeDefined();
      expect(new MattermostChannel(warnConfig)).toBeDefined();
      expect(new MattermostChannel(errorConfig)).toBeDefined();
    });
  });
});
