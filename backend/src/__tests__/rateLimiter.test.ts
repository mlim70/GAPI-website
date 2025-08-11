import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, resetRateLimitStore } from '../utils/accounts/rateLimiter';

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  ip: '192.168.1.1',
  headers: {},
  body: {},
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Rate Limiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    
    // Clear the rate limit store before each test
    resetRateLimitStore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IP-based Rate Limiting (Default Strategy)', () => {
    it('should allow first request within limit', () => {
      const limiter = createRateLimiter(5, 60000); // 5 requests per minute
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow requests up to the limit', () => {
      const limiter = createRateLimiter(3, 60000); // 3 requests per minute
      
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        limiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding the limit', () => {
      const limiter = createRateLimiter(2, 60000); // 2 requests per minute
      
      // Make 2 allowed requests
      for (let i = 0; i < 2; i++) {
        limiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Third request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many requests. Please try again later.',
        retryAfter: expect.any(Number),
        limit: 2,
        window: 60
      });
    });

    it('should reset counter after window expires', () => {
      const limiter = createRateLimiter(2, 100); // 2 requests per 100ms
      
      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        limiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Should allow new request after window expires
          limiter(mockReq as Request, mockRes as Response, mockNext);
          
          expect(mockNext).toHaveBeenCalledTimes(3);
          expect(mockRes.status).not.toHaveBeenCalled();
          resolve(undefined);
        }, 150);
      });
    });

    it('should handle different IP addresses separately', () => {
      const limiter = createRateLimiter(2, 60000); // 2 requests per minute
      
      const req1 = createMockRequest({ ip: '192.168.1.1' });
      const req2 = createMockRequest({ ip: '192.168.1.2' });
      
      // Make 2 requests from first IP
      for (let i = 0; i < 2; i++) {
        limiter(req1 as Request, mockRes as Response, mockNext);
      }
      
      // Make 2 requests from second IP (should be allowed)
      for (let i = 0; i < 2; i++) {
        limiter(req2 as Request, mockRes as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(4);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle missing IP address gracefully', () => {
      const limiter = createRateLimiter(2, 60000);
      const req = createMockRequest({ ip: undefined });
      
      limiter(req as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Email-based Rate Limiting', () => {
    it('should rate limit based on email address', () => {
      const limiter = createRateLimiter(2, 60000, 'email'); // 2 requests per minute per email
      
      const req1 = createMockRequest({ body: { email: 'test@example.com' } });
      const req2 = createMockRequest({ body: { email: 'test@example.com' } });
      const req3 = createMockRequest({ body: { email: 'test@example.com' } });
      
      // First two requests should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third request should be blocked
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle different email addresses separately', () => {
      const limiter = createRateLimiter(2, 60000, 'email');
      
      const req1 = createMockRequest({ body: { email: 'user1@example.com' } });
      const req2 = createMockRequest({ body: { email: 'user2@example.com' } });
      
      // Both should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should normalize email addresses (lowercase and trim)', () => {
      const limiter = createRateLimiter(2, 60000, 'email');
      
      const req1 = createMockRequest({ body: { email: 'TEST@EXAMPLE.COM' } });
      const req2 = createMockRequest({ body: { email: '  test@example.com  ' } });
      const req3 = createMockRequest({ body: { email: 'TEST@EXAMPLE.COM' } });
      
      // First two should be allowed (same email after normalization)
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to IP when email is missing', () => {
      const limiter = createRateLimiter(2, 60000, 'email');
      
      const req1 = createMockRequest({ body: {} });
      const req2 = createMockRequest({ body: {} });
      const req3 = createMockRequest({ body: {} });
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked (IP-based fallback)
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle null/undefined body gracefully', () => {
      const limiter = createRateLimiter(2, 60000, 'email');
      
      const req1 = createMockRequest({ body: null });
      const req2 = createMockRequest({ body: undefined });
      
      // Should fall back to IP-based limiting
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('User-based Rate Limiting', () => {
    it('should rate limit based on JWT token', () => {
      const limiter = createRateLimiter(2, 60000, 'user');
      
      const token1 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test1';
      const token2 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test2';
      
      const req1 = createMockRequest({ headers: { authorization: token1 } });
      const req2 = createMockRequest({ headers: { authorization: token1 } });
      const req3 = createMockRequest({ headers: { authorization: token1 } });
      
      // First two requests should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third request should be blocked
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle different user tokens separately', () => {
      const limiter = createRateLimiter(2, 60000, 'user');
      
      const token1 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user1';
      const token2 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user2';
      
      const req1 = createMockRequest({ headers: { authorization: token1 } });
      const req2 = createMockRequest({ headers: { authorization: token2 } });
      
      // Both should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fall back to IP when authorization header is missing', () => {
      const limiter = createRateLimiter(2, 60000, 'user');
      
      const req1 = createMockRequest({ headers: {} });
      const req2 = createMockRequest({ headers: {} });
      const req3 = createMockRequest({ headers: {} });
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked (IP-based fallback)
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to IP when authorization header is malformed', () => {
      const limiter = createRateLimiter(2, 60000, 'user');
      
      const req1 = createMockRequest({ headers: { authorization: 'InvalidToken' } });
      const req2 = createMockRequest({ headers: { authorization: 'InvalidToken' } });
      const req3 = createMockRequest({ headers: { authorization: 'InvalidToken' } });
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked (IP-based fallback)
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle empty authorization header', () => {
      const limiter = createRateLimiter(2, 60000, 'user');
      
      const req1 = createMockRequest({ headers: { authorization: '' } });
      const req2 = createMockRequest({ headers: { authorization: '' } });
      const req3 = createMockRequest({ headers: { authorization: '' } });
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked (IP-based fallback)
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Custom Rate Limiting', () => {
    it('should use custom key generator when strategy is custom', () => {
      const customKeyGenerator = jest.fn((req: Request) => `custom:${req.headers['user-agent'] || 'unknown'}`);
      const limiter = createRateLimiter(2, 60000, 'custom', customKeyGenerator);
      
      const req1 = createMockRequest({ headers: { 'user-agent': 'Chrome' } });
      const req2 = createMockRequest({ headers: { 'user-agent': 'Chrome' } });
      const req3 = createMockRequest({ headers: { 'user-agent': 'Chrome' } });
      
      // First two requests should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third request should be blocked
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(customKeyGenerator).toHaveBeenCalledTimes(3);
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to IP when custom key generator is not provided', () => {
      const limiter = createRateLimiter(2, 60000, 'custom');
      
      const req1 = createMockRequest();
      const req2 = createMockRequest();
      const req3 = createMockRequest();
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked (IP-based fallback)
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle custom key generator returning empty string', () => {
      const customKeyGenerator = jest.fn(() => '');
      const limiter = createRateLimiter(2, 60000, 'custom', customKeyGenerator);
      
      const req1 = createMockRequest();
      const req2 = createMockRequest();
      const req3 = createMockRequest();
      
      // First two should be allowed
      limiter(req1 as Request, mockRes as Response, mockNext);
      limiter(req2 as Request, mockRes as Response, mockNext);
      
      // Third should be blocked
      limiter(req3 as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large request counts', () => {
      const limiter = createRateLimiter(1000000, 60000); // 1M requests per minute
      
      // Should not crash with large numbers
      expect(() => {
        limiter(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle very small time windows', () => {
      const limiter = createRateLimiter(5, 1); // 5 requests per millisecond
      
      // Should not crash with very small windows
      expect(() => {
        limiter(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle zero requests limit', () => {
      const limiter = createRateLimiter(0, 60000); // 0 requests per minute
      
      // First request should be allowed (count starts at 1)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request should be blocked (count 1 >= limit 0)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle negative requests limit', () => {
      const limiter = createRateLimiter(-5, 60000); // -5 requests per minute
      
      // First request should be allowed (count starts at 1)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request should be blocked (count 1 >= limit -5, but 1 > -5 is true)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle zero time window', () => {
      const limiter = createRateLimiter(5, 0); // 5 requests per 0ms
      
      // First request should be allowed
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request should be allowed (window expires immediately, so it's a fresh window)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle negative time window', () => {
      const limiter = createRateLimiter(5, -1000); // 5 requests per -1 second
      
      // First request should be allowed
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request should be allowed (window expires immediately, so it's a fresh window)
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle concurrent requests from same source', () => {
      const limiter = createRateLimiter(2, 60000);
      
      // Simulate concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            limiter(mockReq as Request, mockRes as Response, mockNext);
            resolve();
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        // Should only allow 2 requests
        expect(mockNext).toHaveBeenCalledTimes(2);
        expect(mockRes.status).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle malformed request objects', () => {
      const limiter = createRateLimiter(5, 60000);
      
      const malformedReq = {} as Request;
      
      // Should not crash
      expect(() => {
        limiter(malformedReq, mockRes as Response, mockNext);
      }).not.toThrow();
    });

    it('should handle missing response methods gracefully', () => {
      const limiter = createRateLimiter(2, 60000);
      
      const incompleteRes = {} as Response;
      
      // Should not crash
      expect(() => {
        limiter(mockReq as Request, incompleteRes, mockNext);
      }).not.toThrow();
    });
  });

  describe('Response Format and Headers', () => {
    it('should return correct 429 status code', () => {
      const limiter = createRateLimiter(1, 60000);
      
      // First request
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Second request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should return correct error message', () => {
      const limiter = createRateLimiter(1, 60000);
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many requests. Please try again later.',
        retryAfter: expect.any(Number),
        limit: 1,
        window: 60
      });
    });

    it('should calculate correct retry after time', () => {
      const limiter = createRateLimiter(1, 1000); // 1 request per second
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const responseData = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(responseData.retryAfter).toBeGreaterThan(0);
      expect(responseData.retryAfter).toBeLessThanOrEqual(1);
    });

    it('should include correct limit and window in response', () => {
      const limiter = createRateLimiter(5, 30000); // 5 requests per 30 seconds
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Sixth request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many requests. Please try again later.',
        retryAfter: expect.any(Number),
        limit: 5,
        window: 30
      });
    });
  });

  describe('Memory Management', () => {
    it('should not accumulate unlimited entries', () => {
      const limiter = createRateLimiter(1, 100); // 1 request per 100ms
      
      // Create many different IPs
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({ ip: `192.168.1.${i}` });
        limiter(req as Request, mockRes as Response, mockNext);
      }
      
      // All should be allowed
      expect(mockNext).toHaveBeenCalledTimes(100);
    });

    it('should handle rapid window expiration', () => {
      const limiter = createRateLimiter(1, 10); // 1 request per 10ms
      
      // Make request
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Should allow new request
          limiter(mockReq as Request, mockRes as Response, mockNext);
          
          expect(mockNext).toHaveBeenCalledTimes(2);
          resolve(undefined);
        }, 20);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed strategies in same application', () => {
      const ipLimiter = createRateLimiter(3, 60000, 'ip');
      const emailLimiter = createRateLimiter(2, 60000, 'email');
      const userLimiter = createRateLimiter(1, 60000, 'user');
      
      const sameIP = createMockRequest({ ip: '192.168.1.1' });
      const sameEmail = createMockRequest({ body: { email: 'test@example.com' } });
      const sameUser = createMockRequest({ headers: { authorization: 'Bearer token123' } });
      
      // Test IP limiter
      ipLimiter(sameIP as Request, mockRes as Response, mockNext);
      ipLimiter(sameIP as Request, mockRes as Response, mockNext);
      ipLimiter(sameIP as Request, mockRes as Response, mockNext);
      ipLimiter(sameIP as Request, mockRes as Response, mockNext); // Should be blocked
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Test email limiter
      emailLimiter(sameEmail as Request, mockRes as Response, mockNext);
      emailLimiter(sameEmail as Request, mockRes as Response, mockNext);
      emailLimiter(sameEmail as Request, mockRes as Response, mockNext); // Should be blocked
      
      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Test user limiter
      userLimiter(sameUser as Request, mockRes as Response, mockNext);
      userLimiter(sameUser as Request, mockRes as Response, mockNext); // Should be blocked
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should handle realistic authentication flow rate limiting', () => {
      // Simulate login attempts with different strategies
      const loginLimiter = createRateLimiter(5, 60000, 'ip'); // 5 attempts per IP per minute
      const emailLimiter = createRateLimiter(3, 60000, 'email'); // 3 attempts per email per minute
      
      const sameIP = createMockRequest({ ip: '192.168.1.1' });
      const sameEmail = createMockRequest({ 
        ip: '192.168.1.1',
        body: { email: 'user@example.com' } 
      });
      
      // Test IP-based login limiting
      for (let i = 0; i < 5; i++) {
        loginLimiter(sameIP as Request, mockRes as Response, mockNext);
      }
      
      // Sixth attempt should be blocked
      loginLimiter(sameIP as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Test email-based limiting (should be separate from IP)
      for (let i = 0; i < 3; i++) {
        emailLimiter(sameEmail as Request, mockRes as Response, mockNext);
      }
      
      // Fourth attempt should be blocked
      emailLimiter(sameEmail as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });
});
