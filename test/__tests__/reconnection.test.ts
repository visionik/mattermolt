/**
 * Unit tests for exponential backoff reconnection logic
 */

describe('Exponential Backoff Reconnection', () => {
  /**
   * Calculate reconnection delay with exponential backoff
   */
  function calculateBackoffDelay(
    attempt: number,
    config: {
      initialDelay: number;
      maxDelay: number;
      multiplier: number;
      jitter: boolean;
    }
  ): number {
    const { initialDelay, maxDelay, multiplier, jitter } = config;
    
    // Calculate delay with exponential backoff
    let delay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return delay;
  }

  describe('Basic Exponential Backoff', () => {
    const config = {
      initialDelay: 1000,
      maxDelay: 60000,
      multiplier: 2,
      jitter: false,
    };

    it('should calculate delay for first attempt (0)', () => {
      const delay = calculateBackoffDelay(0, config);
      expect(delay).toBe(1000); // 1000 * 2^0 = 1000
    });

    it('should calculate delay for second attempt (1)', () => {
      const delay = calculateBackoffDelay(1, config);
      expect(delay).toBe(2000); // 1000 * 2^1 = 2000
    });

    it('should calculate delay for third attempt (2)', () => {
      const delay = calculateBackoffDelay(2, config);
      expect(delay).toBe(4000); // 1000 * 2^2 = 4000
    });

    it('should calculate delay for fourth attempt (3)', () => {
      const delay = calculateBackoffDelay(3, config);
      expect(delay).toBe(8000); // 1000 * 2^3 = 8000
    });

    it('should calculate delay for fifth attempt (4)', () => {
      const delay = calculateBackoffDelay(4, config);
      expect(delay).toBe(16000); // 1000 * 2^4 = 16000
    });

    it('should cap delay at maxDelay', () => {
      const delay = calculateBackoffDelay(10, config);
      expect(delay).toBe(60000); // Capped at maxDelay
    });

    it('should cap delay at maxDelay for very high attempts', () => {
      const delay = calculateBackoffDelay(100, config);
      expect(delay).toBe(60000); // Capped at maxDelay
    });
  });

  describe('Custom Multiplier', () => {
    it('should work with multiplier of 3', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 3,
        jitter: false,
      };

      expect(calculateBackoffDelay(0, config)).toBe(1000); // 1000 * 3^0
      expect(calculateBackoffDelay(1, config)).toBe(3000); // 1000 * 3^1
      expect(calculateBackoffDelay(2, config)).toBe(9000); // 1000 * 3^2
      expect(calculateBackoffDelay(3, config)).toBe(27000); // 1000 * 3^3
    });

    it('should work with multiplier of 1.5', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 1.5,
        jitter: false,
      };

      expect(calculateBackoffDelay(0, config)).toBe(1000); // 1000 * 1.5^0
      expect(calculateBackoffDelay(1, config)).toBe(1500); // 1000 * 1.5^1
      expect(calculateBackoffDelay(2, config)).toBe(2250); // 1000 * 1.5^2
    });
  });

  describe('Custom Initial Delay', () => {
    it('should work with 2000ms initial delay', () => {
      const config = {
        initialDelay: 2000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };

      expect(calculateBackoffDelay(0, config)).toBe(2000);
      expect(calculateBackoffDelay(1, config)).toBe(4000);
      expect(calculateBackoffDelay(2, config)).toBe(8000);
    });

    it('should work with 500ms initial delay', () => {
      const config = {
        initialDelay: 500,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };

      expect(calculateBackoffDelay(0, config)).toBe(500);
      expect(calculateBackoffDelay(1, config)).toBe(1000);
      expect(calculateBackoffDelay(2, config)).toBe(2000);
    });
  });

  describe('Custom Max Delay', () => {
    it('should cap at 30000ms maxDelay', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 2,
        jitter: false,
      };

      expect(calculateBackoffDelay(4, config)).toBe(16000); // Not capped yet
      expect(calculateBackoffDelay(5, config)).toBe(30000); // Capped at 30000
      expect(calculateBackoffDelay(6, config)).toBe(30000); // Still capped
    });

    it('should cap at 10000ms maxDelay', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 10000,
        multiplier: 2,
        jitter: false,
      };

      expect(calculateBackoffDelay(3, config)).toBe(8000); // Not capped yet
      expect(calculateBackoffDelay(4, config)).toBe(10000); // Capped at 10000
    });
  });

  describe('Jitter', () => {
    const config = {
      initialDelay: 1000,
      maxDelay: 60000,
      multiplier: 2,
      jitter: true,
    };

    it('should add jitter to delay (between 50% and 100%)', () => {
      const attempts = [0, 1, 2, 3, 4];
      
      attempts.forEach((attempt) => {
        const delay = calculateBackoffDelay(attempt, config);
        const expectedBase = Math.min(
          config.initialDelay * Math.pow(config.multiplier, attempt),
          config.maxDelay
        );
        
        // Delay should be between 50% and 100% of base
        expect(delay).toBeGreaterThanOrEqual(expectedBase * 0.5);
        expect(delay).toBeLessThanOrEqual(expectedBase);
      });
    });

    it('should produce different delays with jitter', () => {
      const delays = new Set<number>();
      
      // Generate 100 delays for attempt 3
      for (let i = 0; i < 100; i++) {
        const delay = calculateBackoffDelay(3, config);
        delays.add(Math.floor(delay / 100)); // Round to 100ms for comparison
      }
      
      // Should have multiple different values due to jitter
      expect(delays.size).toBeGreaterThan(10);
    });

    it('should not add jitter when disabled', () => {
      const noJitterConfig = { ...config, jitter: false };
      
      const delay1 = calculateBackoffDelay(2, noJitterConfig);
      const delay2 = calculateBackoffDelay(2, noJitterConfig);
      
      expect(delay1).toBe(delay2);
      expect(delay1).toBe(4000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle attempt 0 correctly', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };
      
      const delay = calculateBackoffDelay(0, config);
      expect(delay).toBe(1000);
    });

    it('should handle very large attempt numbers', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };
      
      const delay = calculateBackoffDelay(1000, config);
      expect(delay).toBe(60000);
      expect(isFinite(delay)).toBe(true);
    });

    it('should handle multiplier of 1 (no increase)', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 1,
        jitter: false,
      };
      
      expect(calculateBackoffDelay(0, config)).toBe(1000);
      expect(calculateBackoffDelay(5, config)).toBe(1000);
      expect(calculateBackoffDelay(10, config)).toBe(1000);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should follow spec requirements: 1s initial, 60s max, 2x multiplier', () => {
      const specConfig = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };

      // Verify the sequence matches spec
      expect(calculateBackoffDelay(0, specConfig)).toBe(1000); // 1s
      expect(calculateBackoffDelay(1, specConfig)).toBe(2000); // 2s
      expect(calculateBackoffDelay(2, specConfig)).toBe(4000); // 4s
      expect(calculateBackoffDelay(3, specConfig)).toBe(8000); // 8s
      expect(calculateBackoffDelay(4, specConfig)).toBe(16000); // 16s
      expect(calculateBackoffDelay(5, specConfig)).toBe(32000); // 32s
      expect(calculateBackoffDelay(6, specConfig)).toBe(60000); // 60s (capped)
      expect(calculateBackoffDelay(7, specConfig)).toBe(60000); // 60s (capped)
    });

    it('should reach max delay in reasonable number of attempts', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: false,
      };

      // Should reach max delay by attempt 6
      let attempt = 0;
      while (calculateBackoffDelay(attempt, config) < config.maxDelay) {
        attempt++;
      }
      
      expect(attempt).toBe(6); // 2^6 * 1000 = 64000, capped at 60000
    });
  });
});
