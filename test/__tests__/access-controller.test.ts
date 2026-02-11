import { AccessController, AccessContext } from '../../src/access-controller';
import { Logger } from '../../src/logger';
import { MattermostConfig } from '../../src/config';

describe('AccessController', () => {
  let accessController: AccessController;
  let mockLogger: jest.Mocked<Logger>;
  let config: MattermostConfig;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    config = {
      url: 'https://mattermost.example.com',
      token: 'test-token',
      enabled: true,
      dm: {
        policy: 'pairing',
      },
      groupPolicy: 'allowlist',
    };

    accessController = new AccessController(mockLogger, config);
  });

  describe('DM Access', () => {
    it('should allow DM with open policy', () => {
      config.dm = { policy: 'open' };
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should allow paired user in DM', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      accessController.pairUser('user1');
      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should require pairing for unpaired user', () => {
      const context: AccessContext = {
        userId: 'user1',
        username: 'john',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.requiresPairing).toBe(true);
        expect(decision.pairingCode).toBeDefined();
        expect(decision.pairingCode).toHaveLength(6);
      }
    });

    it('should auto-pair user from allowFrom list', () => {
      config.allowFrom = ['user1', '*@example.com'];
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
      expect(accessController.isPaired('user1')).toBe(true);
    });

    it('should match email pattern in allowFrom', () => {
      config.allowFrom = ['*@company.com'];
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        email: 'john@company.com',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should reject user not matching allowFrom', () => {
      config.allowFrom = ['user2'];
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.requiresPairing).toBe(true);
      }
    });
  });

  describe('Channel Access', () => {
    it('should allow access to explicitly allowed channel', () => {
      config.teams = {
        team1: {
          channels: {
            channel1: {
              allow: true,
            },
          },
        },
      };
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'channel1',
        channelType: 'O',
        teamId: 'team1',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should deny access to explicitly disallowed channel', () => {
      config.teams = {
        team1: {
          channels: {
            channel1: {
              allow: false,
            },
          },
        },
      };
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'channel1',
        channelType: 'O',
        teamId: 'team1',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toContain('not enabled');
      }
    });

    it('should require mention when configured', () => {
      config.teams = {
        team1: {
          channels: {
            channel1: {
              allow: true,
              requireMention: true,
            },
          },
        },
      };
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'channel1',
        channelType: 'O',
        teamId: 'team1',
        isMention: false,
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toContain('mention required');
      }
    });

    it('should allow when mentioned', () => {
      config.teams = {
        team1: {
          channels: {
            channel1: {
              allow: true,
              requireMention: true,
            },
          },
        },
      };
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'channel1',
        channelType: 'O',
        teamId: 'team1',
        isMention: true,
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should allow all channels with open group policy', () => {
      config.groupPolicy = 'open';
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'random-channel',
        channelType: 'O',
        teamId: 'team1',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });

    it('should deny unconfigured channel with allowlist policy', () => {
      config.groupPolicy = 'allowlist';
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        channelId: 'random-channel',
        channelType: 'O',
        teamId: 'team1',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toContain('not in allowlist');
      }
    });
  });

  describe('Pairing Management', () => {
    it('should generate unique pairing codes', () => {
      const context1: AccessContext = {
        userId: 'user1',
        username: 'alice',
        channelId: 'dm1',
        channelType: 'D',
      };

      const context2: AccessContext = {
        userId: 'user2',
        username: 'bob',
        channelId: 'dm2',
        channelType: 'D',
      };

      const decision1 = accessController.checkAccess(context1);
      const decision2 = accessController.checkAccess(context2);

      expect(decision1.allowed).toBe(false);
      expect(decision2.allowed).toBe(false);
      if (!decision1.allowed && !decision2.allowed) {
        expect(decision1.pairingCode).not.toBe(decision2.pairingCode);
      }
    });

    it('should reuse pairing code for same user within 5 minutes', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision1 = accessController.checkAccess(context);
      const decision2 = accessController.checkAccess(context);

      expect(decision1.allowed).toBe(false);
      expect(decision2.allowed).toBe(false);
      if (!decision1.allowed && !decision2.allowed) {
        expect(decision1.pairingCode).toBe(decision2.pairingCode);
      }
    });

    it('should approve valid pairing code', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      
      if (!decision.allowed && decision.pairingCode) {
        const approved = accessController.approvePairing(decision.pairingCode);
        expect(approved).toBe(true);
        expect(accessController.isPaired('user1')).toBe(true);

        // Should now allow access
        const decision2 = accessController.checkAccess(context);
        expect(decision2.allowed).toBe(true);
      }
    });

    it('should reject invalid pairing code', () => {
      const approved = accessController.approvePairing('INVALID');
      expect(approved).toBe(false);
    });

    it('should reject expired pairing code', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      
      if (!decision.allowed && decision.pairingCode) {
        const code = decision.pairingCode;

        // Mock time passing (5+ minutes)
        const request = accessController.getPendingPairing(code);
        if (request) {
          request.timestamp = new Date(Date.now() - 6 * 60 * 1000);
        }

        const approved = accessController.approvePairing(code);
        expect(approved).toBe(false);
      }
    });

    it('should reject pairing code', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      
      if (!decision.allowed && decision.pairingCode) {
        const rejected = accessController.rejectPairing(decision.pairingCode);
        expect(rejected).toBe(true);
        expect(accessController.getPendingPairing(decision.pairingCode)).toBeUndefined();
      }
    });

    it('should get pending pairing by code', () => {
      const context: AccessContext = {
        userId: 'user1',
        username: 'alice',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
      
      if (!decision.allowed && decision.pairingCode) {
        const pending = accessController.getPendingPairing(decision.pairingCode);
        expect(pending).toBeDefined();
        expect(pending?.userId).toBe('user1');
        expect(pending?.username).toBe('alice');
      }
    });

    it('should get pending pairing by user ID', () => {
      const context: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      accessController.checkAccess(context);
      const pending = accessController.getPendingPairingByUserId('user1');

      expect(pending).toBeDefined();
      expect(pending?.userId).toBe('user1');
    });

    it('should unpair user', () => {
      accessController.pairUser('user1');
      expect(accessController.isPaired('user1')).toBe(true);

      accessController.unpairUser('user1');
      expect(accessController.isPaired('user1')).toBe(false);
    });

    it('should clean up expired pairings', () => {
      const context1: AccessContext = {
        userId: 'user1',
        channelId: 'dm1',
        channelType: 'D',
      };

      const context2: AccessContext = {
        userId: 'user2',
        channelId: 'dm2',
        channelType: 'D',
      };

      // Create two pending pairings
      accessController.checkAccess(context1);
      accessController.checkAccess(context2);

      // Expire one of them
      const request1 = accessController.getPendingPairingByUserId('user1');
      if (request1) {
        request1.timestamp = new Date(Date.now() - 6 * 60 * 1000);
      }

      const cleaned = accessController.cleanupExpiredPairings();
      expect(cleaned).toBe(1);
      expect(accessController.getPendingPairingByUserId('user1')).toBeUndefined();
      expect(accessController.getPendingPairingByUserId('user2')).toBeDefined();
    });
  });

  describe('Pattern Matching', () => {
    it('should match wildcard patterns', () => {
      config.allowFrom = ['*@company.com'];
      accessController = new AccessController(mockLogger, config);

      const context1: AccessContext = {
        userId: 'user1',
        email: 'john@company.com',
        channelId: 'dm1',
        channelType: 'D',
      };

      const context2: AccessContext = {
        userId: 'user2',
        email: 'jane@company.com',
        channelId: 'dm2',
        channelType: 'D',
      };

      expect(accessController.checkAccess(context1).allowed).toBe(true);
      expect(accessController.checkAccess(context2).allowed).toBe(true);
    });

    it('should not match non-matching patterns', () => {
      config.allowFrom = ['*@company.com'];
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        email: 'john@other.com',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(false);
    });

    it('should be case insensitive', () => {
      config.allowFrom = ['ADMIN'];
      accessController = new AccessController(mockLogger, config);

      const context: AccessContext = {
        userId: 'user1',
        username: 'admin',
        channelId: 'dm1',
        channelType: 'D',
      };

      const decision = accessController.checkAccess(context);
      expect(decision.allowed).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const sanitized = accessController.sanitizeInput(input);
      expect(sanitized).toBe('hello world');
    });

    it('should limit length', () => {
      const input = 'a'.repeat(5000);
      const sanitized = accessController.sanitizeInput(input, 100);
      expect(sanitized).toHaveLength(100);
    });

    it('should remove null bytes', () => {
      const input = 'hello\0world';
      const sanitized = accessController.sanitizeInput(input);
      expect(sanitized).toBe('helloworld');
    });
  });

  describe('Message Validation', () => {
    it('should accept valid message', () => {
      const result = accessController.validateMessage('Hello, world!');
      expect(result.valid).toBe(true);
    });

    it('should reject excessively long message', () => {
      const message = 'a'.repeat(17000);
      const result = accessController.validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds maximum length');
    });

    it('should reject message with null bytes', () => {
      const message = 'hello\0world';
      const result = accessController.validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid characters');
    });

    it('should reject message with control characters', () => {
      const message = 'hello\x01world';
      const result = accessController.validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('control characters');
    });

    it('should allow newlines and tabs', () => {
      const message = 'hello\nworld\ttab';
      const result = accessController.validateMessage(message);
      expect(result.valid).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      accessController.pairUser('user1');
      accessController.pairUser('user2');

      const context: AccessContext = {
        userId: 'user3',
        channelId: 'dm3',
        channelType: 'D',
      };
      accessController.checkAccess(context);

      const stats = accessController.getStats();
      expect(stats.pairedUsers).toBe(2);
      expect(stats.pendingPairings).toBe(1);
    });
  });
});
