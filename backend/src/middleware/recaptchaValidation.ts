// backend/src/middleware/recaptchaValidation.ts
import { Request, Response, NextFunction } from 'express';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/security/recaptcha';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';
import { logger } from '../utils/general/logger';

interface RecaptchaOptions {
  action: 'registration' | 'login' | 'resend_verification' | 'password_reset' | 'contact_form' | 'newsletter_subscribe';
  threshold?: number;
  required?: boolean;
}

/**
 * Middleware to validate reCAPTCHA tokens
 * Extracts and validates reCAPTCHA from request body
 */
export function validateRecaptcha(options: RecaptchaOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recaptchaToken } = req.body;

      // Check if reCAPTCHA token is required
      if (options.required !== false && !recaptchaToken) {
        logger.warn('Missing reCAPTCHA token');
        return res.status(400).json({ 
          message: 'Security verification required. Please refresh the page and try again.' 
        });
      }

      // Skip validation if token not provided and not required
      if (!recaptchaToken && options.required === false) {
        return next();
      }

      // Ensure we have a token before proceeding with verification
      if (!recaptchaToken) {
        logger.warn('Missing reCAPTCHA token');
        return res.status(400).json({ 
          message: 'Security verification required. Please refresh the page and try again.' 
        });
      }

      logger.debug('===== reCAPTCHA VERIFICATION START =====');
      logger.debug('Starting reCAPTCHA verification...');
      logger.debug('reCAPTCHA token received:', recaptchaToken ? `${recaptchaToken.substring(0, 20)}...` : 'NO TOKEN');
      logger.debug('Token length:', recaptchaToken ? recaptchaToken.length : 0);
      logger.debug('Token type:', typeof recaptchaToken);
      logger.debug('Token is string:', typeof recaptchaToken === 'string');
      logger.debug('Token is empty:', recaptchaToken === '');
      logger.debug('Token is null:', recaptchaToken === null);
      logger.debug('Token is undefined:', recaptchaToken === undefined);
      logger.debug('Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        hasRecaptchaSecret: true, // Validated by env module
        recaptchaSecretLength: 0 // Not exposed for security
      });

      // Verify reCAPTCHA token
      logger.debug('Calling verifyRecaptchaToken...');
      const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
      logger.debug('reCAPTCHA verification result:', {
        success: recaptchaResult.success,
        score: recaptchaResult.score,
        action: recaptchaResult.action,
        error: recaptchaResult.error,
        hasScore: typeof recaptchaResult.score === 'number',
        hasAction: !!recaptchaResult.action,
        scoreType: typeof recaptchaResult.score,
        actionType: typeof recaptchaResult.action
      });

      if (!recaptchaResult.success) {
        logger.warn('reCAPTCHA verification failed:', recaptchaResult.error);
        logger.debug('Full recaptcha result:', recaptchaResult);
        logger.debug('===== reCAPTCHA VERIFICATION FAILED =====');
        logger.debug('Error details:', {
          success: recaptchaResult.success,
          score: recaptchaResult.score,
          action: recaptchaResult.action,
          error: recaptchaResult.error,
          resultType: typeof recaptchaResult,
          resultKeys: Object.keys(recaptchaResult)
        });
        return res.status(400).json({ 
          message: 'Security verification failed. Please try again or contact support if the problem persists.' 
        });
      }

      // Get expected action and threshold
      const actions = {
        registration: RECAPTCHA_CONFIG.ACTIONS.REGISTRATION,
        login: RECAPTCHA_CONFIG.ACTIONS.LOGIN,
        resend_verification: RECAPTCHA_CONFIG.ACTIONS.RESEND_VERIFICATION,
        password_reset: RECAPTCHA_CONFIG.ACTIONS.PASSWORD_RESET,
        contact_form: RECAPTCHA_CONFIG.ACTIONS.CONTACT_FORM,
        newsletter_subscribe: RECAPTCHA_CONFIG.ACTIONS.NEWSLETTER_SUBSCRIBE
      };

      const thresholds = {
        registration: RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION,
        login: RECAPTCHA_CONFIG.THRESHOLDS.LOGIN,
        resend_verification: RECAPTCHA_CONFIG.THRESHOLDS.RESEND_VERIFICATION,
        password_reset: RECAPTCHA_CONFIG.THRESHOLDS.PASSWORD_RESET,
        contact_form: RECAPTCHA_CONFIG.THRESHOLDS.CONTACT_FORM,
        newsletter_subscribe: RECAPTCHA_CONFIG.THRESHOLDS.NEWSLETTER_SUBSCRIBE
      };

      const expectedAction = actions[options.action];
      const threshold = options.threshold || thresholds[options.action];

      // Test bypass for non-production environments
      if (process.env.NODE_ENV !== 'production' && process.env.RECAPTCHA_TEST_BYPASS_TOKEN == 'test-bypass') {
        logger.info('Test bypass enabled for non-production environment');
        logger.debug('===== reCAPTCHA TEST BYPASS =====');
        
        // Create a mock successful result for testing
        const mockResult = {
          success: true,
          score: 0.9,
          action: expectedAction,
          error: null
        };
        
        logger.info('reCAPTCHA test bypass successful');
        logger.debug('===== reCAPTCHA TEST BYPASS END =====');
        
        // Store the mock result in res.locals for use in the route handler
        res.locals.recaptchaResult = mockResult;
        return next();
      }

      // Log the action received from reCAPTCHA
      logger.debug('reCAPTCHA action received:', recaptchaResult.action);
      logger.debug('Expected action:', expectedAction);
      logger.debug('Action comparison:', {
        received: recaptchaResult.action,
        expected: expectedAction,
        isMatch: recaptchaResult.action === expectedAction,
        receivedType: typeof recaptchaResult.action,
        expectedType: typeof expectedAction
      });

      // Validate that the action matches expected
      if (recaptchaResult.action !== expectedAction) {
        logger.warn(`reCAPTCHA action mismatch. Expected: ${expectedAction}, Received: ${recaptchaResult.action}`);
        logger.debug('Action mismatch details:', {
          received: recaptchaResult.action,
          expected: expectedAction,
          receivedType: typeof recaptchaResult.action,
          expectedType: typeof expectedAction,
          receivedLength: recaptchaResult.action ? recaptchaResult.action.length : 0,
          expectedLength: expectedAction.length
        });
        logger.debug('===== reCAPTCHA ACTION MISMATCH =====');
        logger.debug('Action comparison debug:', {
          received: recaptchaResult.action,
          expected: expectedAction,
          receivedStrictEqual: recaptchaResult.action === expectedAction,
          receivedLooseEqual: recaptchaResult.action == expectedAction,
          receivedTrimmed: recaptchaResult.action ? recaptchaResult.action.trim() : 'N/A',
          expectedTrimmed: expectedAction.trim(),
          receivedTrimmedEqual: recaptchaResult.action ? recaptchaResult.action.trim() === expectedAction.trim() : false
        });
        return res.status(400).json({ 
          message: 'Security verification failed. Please try again or contact support if the problem persists.' 
        });
      }

      // Check if score is acceptable
      const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, options.action, threshold);
      logger.debug('Score validation:', {
        score: recaptchaResult.score,
        threshold,
        isAcceptable: isScoreAcceptable,
        scoreType: typeof recaptchaResult.score,
        thresholdType: typeof threshold
      });

      if (!isScoreAcceptable) {
        logger.warn('reCAPTCHA score too low:', recaptchaResult.score);
        logger.debug('Score validation failed:', {
          score: recaptchaResult.score,
          threshold,
          difference: recaptchaResult.score - threshold,
          scoreType: typeof recaptchaResult.score
        });
        logger.debug('===== reCAPTCHA SCORE TOO LOW =====');
        logger.debug('Score validation debug:', {
          score: recaptchaResult.score,
          threshold,
          isScoreNumber: typeof recaptchaResult.score === 'number',
          isScoreValid: !isNaN(recaptchaResult.score) && isFinite(recaptchaResult.score),
          scoreRange: recaptchaResult.score >= 0 && recaptchaResult.score <= 1 ? 'valid' : 'out of range',
          comparison: recaptchaResult.score >= threshold
        });
        return res.status(400).json({ 
          message: 'Security verification failed. Please try again or contact support if the problem persists.' 
        });
      }

      logger.info('reCAPTCHA verification passed with score:', recaptchaResult.score);
      logger.debug('===== reCAPTCHA VERIFICATION END =====');

      // Store the verified result in res.locals for use in the route handler
      res.locals.recaptchaResult = recaptchaResult;

      next();
    } catch (error) {
      logger.error('reCAPTCHA validation middleware error:', error);
      return res.status(500).json({ 
        message: 'Security verification failed. Please try again or contact support if the problem persists.' 
      });
    }
  };
}
