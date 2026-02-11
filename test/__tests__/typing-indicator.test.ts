/**
 * Tests for typing indicator functionality
 */

import { MessageHandler } from '../../src/message-handler.js';
import type { Client4 } from '@mattermost/client';

describe('TypingIndicator', () => {
  let messageHandler: MessageHandler;
  let mockClient: jest.Mocked<Client4>;
  let mockConnectionManager: any;

  beforeEach(() => {
    mockClient = {
      getPost: jest.fn(),
    } as unknown as jest.Mocked<Client4>;

    mockConnectionManager = {
      sendWebSocketAction: jest.fn(),
    };

    messageHandler = new MessageHandler(mockClient, 'test-agent', mockConnectionManager);
    messageHandler.setBotUserId('bot-user-id');
  });

  describe('sendTypingIndicator', () => {
    it('should send typing indicator for channel session', async () => {
      const sessionId = 'agent:test-agent:mattermost:channel:channel-123';

      await messageHandler.sendTypingIndicator(sessionId);

      expect(mockConnectionManager.sendWebSocketAction).toHaveBeenCalledWith('user_typing', {
        channel_id: 'channel-123',
        parent_id: undefined,
      });
    });

    it('should send typing indicator with parent ID for thread session', async () => {
      const sessionId = 'agent:test-agent:mattermost:thread:thread-456';
      mockClient.getPost.mockResolvedValue({
        id: 'thread-456',
        channel_id: 'channel-789',
      } as any);

      await messageHandler.sendTypingIndicator(sessionId, 'parent-post-id');

      expect(mockClient.getPost).toHaveBeenCalledWith('thread-456');
      expect(mockConnectionManager.sendWebSocketAction).toHaveBeenCalledWith('user_typing', {
        channel_id: 'channel-789',
        parent_id: 'parent-post-id',
      });
    });

    it('should not throw on typing indicator error', async () => {
      const sessionId = 'agent:test-agent:mattermost:channel:channel-123';
      mockConnectionManager.sendWebSocketAction.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      // Should not throw
      await expect(messageHandler.sendTypingIndicator(sessionId)).resolves.toBeUndefined();
    });

    it('should not send typing indicator if ConnectionManager not available', async () => {
      const handler = new MessageHandler(mockClient, 'test-agent');
      const sessionId = 'agent:test-agent:mattermost:channel:channel-123';

      await handler.sendTypingIndicator(sessionId);

      // Should not crash
      expect(mockConnectionManager.sendWebSocketAction).not.toHaveBeenCalled();
    });

    it('should handle invalid session ID gracefully', async () => {
      const sessionId = 'invalid:session';

      await expect(messageHandler.sendTypingIndicator(sessionId)).resolves.toBeUndefined();

      expect(mockConnectionManager.sendWebSocketAction).not.toHaveBeenCalled();
    });
  });

  describe('Configuration validation', () => {
    it('should validate typingIndicators as boolean', () => {
      const { validateConfig } = require('../../src/config.js');

      const validConfig = {
        enabled: true,
        url: 'https://example.com',
        token: 'valid-token-123',
        typingIndicators: false,
      };

      const result = validateConfig(validConfig);
      expect(result.typingIndicators).toBe(false);
    });

    it('should default typingIndicators to true', () => {
      const { validateConfig } = require('../../src/config.js');

      const config = {
        enabled: true,
        url: 'https://example.com',
        token: 'valid-token-123',
      };

      const result = validateConfig(config);
      expect(result.typingIndicators).toBe(true);
    });

    it('should reject non-boolean typingIndicators', () => {
      const { validateConfig, ConfigValidationError } = require('../../src/config.js');

      const invalidConfig = {
        enabled: true,
        url: 'https://example.com',
        token: 'valid-token-123',
        typingIndicators: 'yes',
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
      expect(() => validateConfig(invalidConfig)).toThrow('typingIndicators must be a boolean');
    });
  });
});
