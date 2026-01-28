/**
 * Unit tests for SessionMapper
 */

import { SessionMapper } from '../../src/session-mapper';

describe('SessionMapper', () => {
  let mapper: SessionMapper;

  beforeEach(() => {
    mapper = new SessionMapper('main');
  });

  describe('DM Mapping', () => {
    it('should map DM to agent:main:main', () => {
      const sessionId = mapper.mapDmToSession();
      expect(sessionId).toBe('agent:main:main');
    });

    it('should identify DM session', () => {
      expect(mapper.isDmSession('agent:main:main')).toBe(true);
      expect(mapper.isDmSession('agent:main:mattermost:channel:123')).toBe(false);
    });
  });

  describe('Channel Mapping', () => {
    it('should map channel to correct format', () => {
      const sessionId = mapper.mapChannelToSession('channel123');
      expect(sessionId).toBe('agent:main:mattermost:channel:channel123');
    });

    it('should identify channel session', () => {
      expect(mapper.isChannelSession('agent:main:mattermost:channel:123')).toBe(true);
      expect(mapper.isChannelSession('agent:main:main')).toBe(false);
      expect(mapper.isChannelSession('agent:main:mattermost:thread:123')).toBe(false);
    });

    it('should extract channel ID from session', () => {
      const channelId = mapper.extractChannelIdFromSession('agent:main:mattermost:channel:abc123');
      expect(channelId).toBe('abc123');
    });

    it('should return null for non-channel session', () => {
      expect(mapper.extractChannelIdFromSession('agent:main:main')).toBeNull();
      expect(mapper.extractChannelIdFromSession('agent:main:mattermost:thread:123')).toBeNull();
    });
  });

  describe('Thread Mapping', () => {
    it('should map thread to correct format', () => {
      const sessionId = mapper.mapThreadToSession('thread456');
      expect(sessionId).toBe('agent:main:mattermost:thread:thread456');
    });

    it('should identify thread session', () => {
      expect(mapper.isThreadSession('agent:main:mattermost:thread:123')).toBe(true);
      expect(mapper.isThreadSession('agent:main:main')).toBe(false);
      expect(mapper.isThreadSession('agent:main:mattermost:channel:123')).toBe(false);
    });

    it('should extract thread ID from session', () => {
      const threadId = mapper.extractThreadIdFromSession('agent:main:mattermost:thread:def456');
      expect(threadId).toBe('def456');
    });

    it('should return null for non-thread session', () => {
      expect(mapper.extractThreadIdFromSession('agent:main:main')).toBeNull();
      expect(mapper.extractThreadIdFromSession('agent:main:mattermost:channel:123')).toBeNull();
    });
  });

  describe('getSessionIdFromPost', () => {
    it('should map DM post', () => {
      const sessionId = mapper.getSessionIdFromPost({
        channel_type: 'D',
        channel_id: 'dm_channel_123',
      });
      expect(sessionId).toBe('agent:main:main');
    });

    it('should map channel post', () => {
      const sessionId = mapper.getSessionIdFromPost({
        channel_type: 'O',
        channel_id: 'channel_123',
      });
      expect(sessionId).toBe('agent:main:mattermost:channel:channel_123');
    });

    it('should map private channel post', () => {
      const sessionId = mapper.getSessionIdFromPost({
        channel_type: 'P',
        channel_id: 'private_channel_123',
      });
      expect(sessionId).toBe('agent:main:mattermost:channel:private_channel_123');
    });

    it('should map thread reply', () => {
      const sessionId = mapper.getSessionIdFromPost({
        channel_type: 'O',
        channel_id: 'channel_123',
        root_id: 'thread_root_456',
      });
      expect(sessionId).toBe('agent:main:mattermost:thread:thread_root_456');
    });

    it('should prioritize thread over channel', () => {
      // Thread replies should map to thread session, not channel
      const sessionId = mapper.getSessionIdFromPost({
        channel_type: 'D',
        channel_id: 'dm_channel_123',
        root_id: 'thread_root_789',
      });
      expect(sessionId).toBe('agent:main:mattermost:thread:thread_root_789');
    });
  });

  describe('Custom Agent ID', () => {
    it('should use custom agent ID in channel mapping', () => {
      const customMapper = new SessionMapper('custom-agent');
      const sessionId = customMapper.mapChannelToSession('channel123');
      expect(sessionId).toBe('agent:custom-agent:mattermost:channel:channel123');
    });

    it('should use custom agent ID in thread mapping', () => {
      const customMapper = new SessionMapper('my-bot');
      const sessionId = customMapper.mapThreadToSession('thread456');
      expect(sessionId).toBe('agent:my-bot:mattermost:thread:thread456');
    });

    it('should not affect DM mapping', () => {
      const customMapper = new SessionMapper('custom-agent');
      const sessionId = customMapper.mapDmToSession();
      expect(sessionId).toBe('agent:main:main');
    });
  });
});
