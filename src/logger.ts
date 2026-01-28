/**
 * Logging utility for MatterMolt with token redaction and correlation IDs
 */

import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Component name for log context */
  component?: string;
  /** Correlation ID for request tracking */
  correlationId?: string;
}

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  // MatterMost tokens (typically 26 characters)
  /([a-z0-9]{26})/gi,
  // Bearer tokens
  /Bearer\s+([^\s]+)/gi,
  // Generic tokens in key-value pairs
  /(token|password|secret|key)["']?\s*[:=]\s*["']?([^\s"',}]+)/gi,
];

/**
 * Redacts sensitive information from strings
 * @param text The text to redact
 * @returns Redacted text
 */
function redactSensitiveData(text: string): string {
  let redacted = text;

  // Replace each pattern with redacted placeholder
  SENSITIVE_PATTERNS.forEach((pattern) => {
    redacted = redacted.replace(pattern, (match) => {
      // Keep the structure but redact the value
      if (match.includes(':') || match.includes('=')) {
        return match.replace(/([^:=]+)$/, '***REDACTED***');
      }
      // For standalone tokens, show first/last 4 chars
      if (match.length > 8) {
        return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
      }
      return '***REDACTED***';
    });
  });

  return redacted;
}

/**
 * Custom serializer for redacting sensitive data
 */
const redactSerializer = (obj: unknown): unknown => {
  if (typeof obj === 'string') {
    return redactSensitiveData(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSerializer);
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact known sensitive fields
      if (['token', 'password', 'secret', 'authorization'].includes(key.toLowerCase())) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = redactSerializer(value);
      }
    }
    return result;
  }

  return obj;
};

/**
 * Creates a logger instance with MatterMolt configuration
 * @param options Logger options
 * @returns Configured Pino logger
 */
export function createLogger(options: LoggerOptions = {}): PinoLogger {
  const { level = 'info', component = 'mattermolt', correlationId } = options;

  const logger = pino({
    level,
    base: {
      component,
      ...(correlationId && { correlationId }),
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
      bindings: (bindings) => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          pid: bindings.pid,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          hostname: bindings.hostname,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          component: bindings.component,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          correlationId: bindings.correlationId,
        };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      req: (req) => redactSerializer(pino.stdSerializers.req(req)),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res: (res) => redactSerializer(pino.stdSerializers.res(res)),
    },
    redact: {
      paths: [
        'token',
        'password',
        'secret',
        'authorization',
        '*.token',
        '*.password',
        '*.secret',
        '*.authorization',
      ],
      censor: '***REDACTED***',
    },
  });

  return logger;
}

/**
 * Logger wrapper class for convenient usage
 */
export class Logger {
  private logger: PinoLogger;

  constructor(options: LoggerOptions = {}) {
    this.logger = createLogger(options);
  }

  /**
   * Creates a child logger with additional context
   * @param context Additional context fields
   * @returns Child logger
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void;
  debug(obj: object, message?: string, ...args: unknown[]): void;
  debug(objOrMessage: object | string, ...args: unknown[]): void {
    if (typeof objOrMessage === 'string') {
      this.logger.debug(redactSensitiveData(objOrMessage));
    } else {
      const [message] = args;
      this.logger.debug(
        redactSerializer(objOrMessage) as object,
        typeof message === 'string' ? redactSensitiveData(message) : (message as string)
      );
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void;
  info(obj: object, message?: string, ...args: unknown[]): void;
  info(objOrMessage: object | string, ...args: unknown[]): void {
    if (typeof objOrMessage === 'string') {
      this.logger.info(redactSensitiveData(objOrMessage));
    } else {
      const [message] = args;
      this.logger.info(
        redactSerializer(objOrMessage) as object,
        typeof message === 'string' ? redactSensitiveData(message) : (message as string)
      );
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void;
  warn(obj: object, message?: string, ...args: unknown[]): void;
  warn(objOrMessage: object | string, ...args: unknown[]): void {
    if (typeof objOrMessage === 'string') {
      this.logger.warn(redactSensitiveData(objOrMessage));
    } else {
      const [message] = args;
      this.logger.warn(
        redactSerializer(objOrMessage) as object,
        typeof message === 'string' ? redactSensitiveData(message) : (message as string)
      );
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void;
  error(obj: object, message?: string, ...args: unknown[]): void;
  error(objOrMessage: object | string, ...args: unknown[]): void {
    if (typeof objOrMessage === 'string') {
      this.logger.error(redactSensitiveData(objOrMessage));
    } else {
      const [message] = args;
      this.logger.error(
        redactSerializer(objOrMessage) as object,
        typeof message === 'string' ? redactSensitiveData(message) : (message as string)
      );
    }
  }

  /**
   * Get the underlying Pino logger
   */
  get pino(): PinoLogger {
    return this.logger;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();
