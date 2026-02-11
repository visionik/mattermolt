/**
 * Unit tests for logger with token redaction
 */

import { Logger, createLogger } from '../../src/logger';

// Mock pino to capture log calls
jest.mock('pino', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  };

  const pinoMock: any = jest.fn(() => mockLogger);
  
  // Add stdSerializers
  pinoMock.stdSerializers = {
    err: jest.fn((err: any) => ({ message: err.message, stack: err.stack })),
    req: jest.fn((req: any) => ({ method: req.method, url: req.url })),
    res: jest.fn((res: any) => ({ statusCode: res.statusCode })),
  };

  return pinoMock;
});

describe('Logger', () => {
  let logger: Logger;
  let mockPino: any;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new Logger({ level: 'debug', component: 'test' });
    mockPino = logger.pino;
  });

  describe('Token Redaction', () => {
    it('should redact MatterMost tokens in string messages', () => {
      const message = 'Connecting with token: abcdefghijklmnopqrstuvwxyz';
      logger.info(message);

      const loggedMessage = mockPino.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain('abcdefghijklmnopqrstuvwxyz');
      expect(loggedMessage).toContain('***REDACTED***');
    });

    it('should redact Bearer tokens', () => {
      const message = 'Authorization: Bearer my-secret-token-here';
      logger.info(message);

      const loggedMessage = mockPino.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain('my-secret-token-here');
    });

    it('should redact tokens in key-value pairs', () => {
      const message = 'Config: token=my-secret-token password=my-password';
      logger.info(message);

      const loggedMessage = mockPino.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain('my-secret-token');
      expect(loggedMessage).not.toContain('my-password');
      expect(loggedMessage).toContain('***REDACTED***');
    });

    it('should redact token field in objects', () => {
      const obj = {
        url: 'https://mattermost.example.com',
        token: 'my-secret-token',
        user: 'bot',
      };
      logger.info(obj, 'Connecting');

      const loggedObj = mockPino.info.mock.calls[0][0];
      expect(loggedObj.token).toBe('***REDACTED***');
      expect(loggedObj.url).toBe('https://mattermost.example.com');
      expect(loggedObj.user).toBe('bot');
    });

    it('should redact password field in objects', () => {
      const obj = {
        username: 'admin',
        password: 'my-password',
      };
      logger.warn(obj, 'Login attempt');

      const loggedObj = mockPino.warn.mock.calls[0][0];
      expect(loggedObj.password).toBe('***REDACTED***');
      expect(loggedObj.username).toBe('admin');
    });

    it('should redact secret field in objects', () => {
      const obj = {
        apiKey: 'public-key',
        secret: 'my-secret-value',
      };
      logger.debug(obj, 'API call');

      const loggedObj = mockPino.debug.mock.calls[0][0];
      expect(loggedObj.secret).toBe('***REDACTED***');
      expect(loggedObj.apiKey).toBe('public-key');
    });

    it('should redact authorization field in objects', () => {
      const obj = {
        method: 'GET',
        authorization: 'Bearer my-token',
      };
      logger.info(obj, 'HTTP request');

      const loggedObj = mockPino.info.mock.calls[0][0];
      expect(loggedObj.authorization).toBe('***REDACTED***');
      expect(loggedObj.method).toBe('GET');
    });

    it('should redact nested sensitive fields', () => {
      const obj = {
        config: {
          url: 'https://example.com',
          token: 'nested-token',
        },
        credentials: {
          password: 'nested-password',
        },
      };
      logger.info(obj, 'Complex object');

      const loggedObj = mockPino.info.mock.calls[0][0];
      expect(loggedObj.config.token).toBe('***REDACTED***');
      expect(loggedObj.credentials.password).toBe('***REDACTED***');
      expect(loggedObj.config.url).toBe('https://example.com');
    });

    it('should handle arrays in objects', () => {
      const obj = {
        values: ['value1', 'value2'],
        urls: ['https://example1.com', 'https://example2.com'],
      };
      logger.debug(obj);

      const loggedObj = mockPino.debug.mock.calls[0][0];
      // Arrays are serialized recursively
      expect(Array.isArray(loggedObj.values)).toBe(true);
      expect(loggedObj.urls).toEqual(['https://example1.com', 'https://example2.com']);
    });
  });

  describe('Log Levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(mockPino.debug).toHaveBeenCalledTimes(1);
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(mockPino.info).toHaveBeenCalledTimes(1);
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');
      expect(mockPino.warn).toHaveBeenCalledTimes(1);
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(mockPino.error).toHaveBeenCalledTimes(1);
    });

    it('should log objects with messages', () => {
      const obj = { key: 'value' };
      logger.info(obj, 'Info with object');

      expect(mockPino.info).toHaveBeenCalledTimes(1);
      const [loggedObj, message] = mockPino.info.mock.calls[0];
      expect(loggedObj).toMatchObject({ key: 'value' });
      expect(message).toBe('Info with object');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with context', () => {
      mockPino.child.mockReturnValue({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      });

      const childLogger = logger.child({ requestId: '123' });
      expect(mockPino.child).toHaveBeenCalledWith({ requestId: '123' });
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('createLogger', () => {
    it('should create logger with default options', () => {
      const pinoLogger = createLogger();
      expect(pinoLogger).toBeDefined();
    });

    it('should create logger with custom level', () => {
      const pinoLogger = createLogger({ level: 'error' });
      expect(pinoLogger).toBeDefined();
    });

    it('should create logger with custom component', () => {
      const pinoLogger = createLogger({ component: 'custom-component' });
      expect(pinoLogger).toBeDefined();
    });

    it('should create logger with correlation ID', () => {
      const pinoLogger = createLogger({
        component: 'test',
        correlationId: 'correlation-123',
      });
      expect(pinoLogger).toBeDefined();
    });
  });

  describe('Logger Constructor', () => {
    it('should create logger with default options', () => {
      const newLogger = new Logger();
      expect(newLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom options', () => {
      const newLogger = new Logger({
        level: 'warn',
        component: 'custom',
        correlationId: 'abc-123',
      });
      expect(newLogger).toBeInstanceOf(Logger);
    });
  });
});
