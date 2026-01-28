/**
 * MatterMolt - MatterMost channel adapter for MoltBot Gateway
 * @module mattermolt
 */

export { MattermostChannel } from './mattermost-channel.js';
export { ConnectionManager } from './connection-manager.js';
export { validateConfig, ConfigValidationError, DEFAULT_CONFIG } from './config.js';
export { Logger, createLogger } from './logger.js';
export type {
  MattermostConfig,
  DmPolicyConfig,
  ChannelConfig,
  TeamConfig,
  RetryConfig,
} from './config.js';
export type { LoggerOptions } from './logger.js';
export type {
  Channel,
  ChannelEventHandlers,
  ConnectionState,
  MessageEvent,
  MessageContent,
  FileAttachment,
  SendMessageOptions,
} from './types.js';

/**
 * Creates and configures a MatterMost channel adapter
 * @param config MatterMost configuration
 * @param eventHandlers Event handlers for the channel
 * @returns Configured MatterMost channel instance
 */
import { validateConfig as _validateConfig } from './config.js';
import { MattermostChannel as _MattermostChannel } from './mattermost-channel.js';
import type { ChannelEventHandlers } from './types.js';

export function createMattermostChannel(
  config: unknown,
  eventHandlers?: ChannelEventHandlers
): _MattermostChannel {
  const validatedConfig = _validateConfig(config);
  return new _MattermostChannel(validatedConfig, eventHandlers);
}
