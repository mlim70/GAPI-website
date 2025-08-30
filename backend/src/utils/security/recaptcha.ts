// backend/src/utils/recaptcha.ts
import axios from 'axios';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { logger } from '../general/logger';

interface RecaptchaVerificationResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

import { RECAPTCHA_SECRET_KEY } from '../../config/env';

/**
 * Verify reCAPTCHA v3 token
 * @param token - The reCAPTCHA token from the frontend
 * @param remoteIp - The user's IP address (optional, for additional security)
 * @returns Promise<boolean> - true if verification passes, false otherwise
 */
export async function verifyRecaptchaToken(
  token: string, 
  remoteIp?: string
): Promise<{ success: boolean; score: number; action?: string; error?: string; hostname?: string }> {
  // --- TEST BYPASS (non-production) ---
  const bypass = process.env.RECAPTCHA_TEST_BYPASS_TOKEN?.trim();
  if (process.env.NODE_ENV !== 'production' && bypass && token === bypass) {
    return {
      success: true,
      score: 1,
      action: 'bypass',
    };
  }

  try {
    logger.info('🔍 reCAPTCHA verification started:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...',
      hasRemoteIp: !!remoteIp,
      remoteIp: remoteIp || 'not provided'
    });

    // Prepare the verification request
    logger.info('🔍 reCAPTCHA secret key status:', {
      hasSecret: !!RECAPTCHA_SECRET_KEY,
      secretLength: RECAPTCHA_SECRET_KEY.length,
      secretPrefix: RECAPTCHA_SECRET_KEY.substring(0, 10) + '...'
    });

    const verificationData = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
      ...(remoteIp && { remoteip: remoteIp })
    });

    logger.info('🔍 Verification request data prepared:', {
      hasSecret: !!verificationData.get('secret'),
      hasResponse: !!verificationData.get('response'),
      hasRemoteIp: !!verificationData.get('remoteip'),
      dataLength: verificationData.toString().length
    });

    // Verify with Google's reCAPTCHA API
    logger.info('🔍 Making request to Google reCAPTCHA API...');
    const response = await axios.post<RecaptchaVerificationResponse>(
      'https://www.google.com/recaptcha/api/siteverify',
      verificationData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    logger.info('🔍 Google reCAPTCHA API response received:', {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    const { success, score, action, 'error-codes': errorCodes, hostname } = response.data;

    // Quick server-side debug (temporary)
    logger.info('reCAPTCHA verify result', {
      success: response.data.success,
      score: response.data.score,
      action: response.data.action,
      hostname: response.data.hostname,
      errorCodes: response.data['error-codes']
    });

    logger.info('🔍 Parsed response data:', {
      success,
      score,
      action,
      hostname,
      hasErrorCodes: !!errorCodes,
      errorCodesCount: errorCodes ? errorCodes.length : 0,
      errorCodes: errorCodes || []
    });

    if (!success) {
      const errors = errorCodes?.join(', ') || 'Unknown error';
      logger.warn('⚠️ reCAPTCHA verification failed:', { 
        errors, 
        token: token.substring(0, 10) + '...',
        fullResponse: response.data
      });
      return { success: false, score: 0, error: `Verification failed: ${errors}` };
    }

    // Validate hostname to prevent token reuse from other domains
    if (hostname) {
      const allowedHostnames = RECAPTCHA_CONFIG.ALLOWED_HOSTNAMES;
      
      const isHostnameAllowed = allowedHostnames.some(allowed => 
        hostname === allowed || hostname.endsWith(`.${allowed}`)
      );
      
      if (!isHostnameAllowed) {
        logger.warn('⚠️ reCAPTCHA hostname validation failed:', {
          receivedHostname: hostname,
          allowedHostnames,
          isHostnameAllowed
        });
        return { 
          success: false, 
          score: 0, 
          error: `Hostname validation failed: ${hostname}`,
          hostname 
        };
      }
      
      logger.info('✅ Hostname validation passed:', { hostname, allowedHostnames });
    }

    // Log verification details (without sensitive data)
    logger.info('✅ reCAPTCHA verification successful:', { 
      score, 
      action, 
      hostname,
      hasRemoteIp: !!remoteIp,
      scoreType: typeof score,
      actionType: typeof action,
      hostnameType: typeof hostname
    });

    return { success: true, score, action, hostname };
  } catch (error) {
    logger.error('❌ reCAPTCHA verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      hasStack: error instanceof Error ? !!error.stack : false,
      stackLength: error instanceof Error ? error.stack?.length : 0
    });
    
    if (axios.isAxiosError(error)) {
      logger.error('❌ Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          hasHeaders: !!error.config?.headers
        }
      });
    }
    
    return { 
      success: false, 
      score: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if a reCAPTCHA score is acceptable for the given action
 * @param score - The reCAPTCHA score (0.0 = bot, 1.0 = human)
 * @param action - The action being performed
 * @param threshold - Minimum acceptable score (default: 0.5)
 * @returns boolean - true if score is acceptable
 */
export function isRecaptchaScoreAcceptable(
  score: number, 
  action: string, 
  threshold: number = 0.5
): boolean {
  logger.info(`🔍 reCAPTCHA score validation for ${action}:`, {
    score,
    threshold,
    scoreType: typeof score,
    thresholdType: typeof threshold,
    isNumber: !isNaN(score),
    isFinite: isFinite(score),
    scoreRange: score >= 0 && score <= 1 ? 'valid' : 'out of range'
  });

  const isAcceptable = score >= threshold;
  
  logger.info(`🔍 reCAPTCHA score check for ${action}:`, {
    score,
    threshold,
    isAcceptable,
    difference: score - threshold
  });

  return isAcceptable;
}
