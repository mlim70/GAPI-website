//backend/src/middleware/recaptchaValidation.ts
import { Request, Response, NextFunction } from 'express';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';

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
        console.log('❌ Missing reCAPTCHA token');
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
        console.log('❌ Missing reCAPTCHA token');
        return res.status(400).json({ 
          message: 'Security verification required. Please refresh the page and try again.' 
        });
      }

      console.log('🔍 ===== reCAPTCHA VERIFICATION START =====');
      console.log('🔍 Starting reCAPTCHA verification...');
      console.log('🔍 reCAPTCHA token received:', recaptchaToken ? `${recaptchaToken.substring(0, 20)}...` : 'NO TOKEN');
      console.log('🔍 Token length:', recaptchaToken ? recaptchaToken.length : 0);
      console.log('🔍 Token type:', typeof recaptchaToken);
      console.log('🔍 Token is string:', typeof recaptchaToken === 'string');
      console.log('🔍 Token is empty:', recaptchaToken === '');
      console.log('🔍 Token is null:', recaptchaToken === null);
      console.log('🔍 Token is undefined:', recaptchaToken === undefined);
      console.log('🔍 Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        hasRecaptchaSecret: true, // Validated by env module
        recaptchaSecretLength: 0 // Not exposed for security
      });

      // Verify reCAPTCHA token
      console.log('🔍 Calling verifyRecaptchaToken...');
      const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
      console.log('🔍 reCAPTCHA verification result:', {
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
        console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
        console.log('❌ Full recaptcha result:', recaptchaResult);
        console.log('❌ ===== reCAPTCHA VERIFICATION FAILED =====');
        console.log('❌ Error details:', {
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
      const expectedActions = {
        registration: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.REGISTRATION,
        login: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.LOGIN,
        resend_verification: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.RESEND_VERIFICATION,
        password_reset: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.PASSWORD_RESET,
        contact_form: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.CONTACT_FORM,
        newsletter_subscribe: RECAPTCHA_CONFIG.EXPECTED_ACTIONS.NEWSLETTER_SUBSCRIBE
      };

      const thresholds = {
        registration: RECAPTCHA_CONFIG.THRESHOLDS.REGISTRATION,
        login: RECAPTCHA_CONFIG.THRESHOLDS.LOGIN,
        resend_verification: RECAPTCHA_CONFIG.THRESHOLDS.RESEND_VERIFICATION,
        password_reset: RECAPTCHA_CONFIG.THRESHOLDS.PASSWORD_RESET,
        contact_form: RECAPTCHA_CONFIG.THRESHOLDS.CONTACT_FORM,
        newsletter_subscribe: RECAPTCHA_CONFIG.THRESHOLDS.NEWSLETTER_SUBSCRIBE
      };

      const expectedAction = expectedActions[options.action];
      const threshold = options.threshold || thresholds[options.action];

      // Log the action received from reCAPTCHA
      console.log('🔍 reCAPTCHA action received:', recaptchaResult.action);
      console.log('🔍 Expected action:', expectedAction);
      console.log('🔍 Action comparison:', {
        received: recaptchaResult.action,
        expected: expectedAction,
        isMatch: recaptchaResult.action === expectedAction,
        receivedType: typeof recaptchaResult.action,
        expectedType: typeof expectedAction
      });

      // Validate that the action matches expected
      if (recaptchaResult.action !== expectedAction) {
        console.log('❌ reCAPTCHA action mismatch. Expected:', expectedAction, 'Received:', recaptchaResult.action);
        console.log('❌ Action mismatch details:', {
          received: recaptchaResult.action,
          expected: expectedAction,
          receivedType: typeof recaptchaResult.action,
          expectedType: typeof expectedAction,
          receivedLength: recaptchaResult.action ? recaptchaResult.action.length : 0,
          expectedLength: expectedAction.length
        });
        console.log('❌ ===== reCAPTCHA ACTION MISMATCH =====');
        console.log('❌ Action comparison debug:', {
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
      console.log('🔍 Score validation:', {
        score: recaptchaResult.score,
        threshold,
        isAcceptable: isScoreAcceptable,
        scoreType: typeof recaptchaResult.score,
        thresholdType: typeof threshold
      });

      if (!isScoreAcceptable) {
        console.log('❌ reCAPTCHA score too low:', recaptchaResult.score);
        console.log('❌ Score validation failed:', {
          score: recaptchaResult.score,
          threshold,
          difference: recaptchaResult.score - threshold,
          scoreType: typeof recaptchaResult.score
        });
        console.log('❌ ===== reCAPTCHA SCORE TOO LOW =====');
        console.log('❌ Score validation debug:', {
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

      console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);
      console.log('🔍 ===== reCAPTCHA VERIFICATION END =====');

      // Store the verified result in res.locals for use in the route handler
      res.locals.recaptchaResult = recaptchaResult;

      next();
    } catch (error) {
      console.error('❌ reCAPTCHA validation middleware error:', error);
      return res.status(500).json({ 
        message: 'Security verification failed. Please try again or contact support if the problem persists.' 
      });
    }
  };
}
