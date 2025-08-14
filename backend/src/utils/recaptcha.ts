import axios from 'axios';

interface RecaptchaVerificationResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

// Lazy loading function for the secret key
function getRecaptchaSecretKey(): string {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY environment variable is required');
  }
  return secretKey;
}

/**
 * Verify reCAPTCHA v3 token
 * @param token - The reCAPTCHA token from the frontend
 * @param remoteIp - The user's IP address (optional, for additional security)
 * @returns Promise<boolean> - true if verification passes, false otherwise
 */
export async function verifyRecaptchaToken(
  token: string, 
  remoteIp?: string
): Promise<{ success: boolean; score: number; action?: string; error?: string }> {
  try {
    console.log('🔍 reCAPTCHA verification started:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...',
      hasRemoteIp: !!remoteIp,
      remoteIp: remoteIp || 'not provided'
    });

    // Prepare the verification request
    const secretKey = getRecaptchaSecretKey();
    console.log('🔍 reCAPTCHA secret key status:', {
      hasSecret: !!secretKey,
      secretLength: secretKey.length,
      secretPrefix: secretKey.substring(0, 10) + '...'
    });

    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp })
    });

    console.log('🔍 Verification request data prepared:', {
      hasSecret: !!verificationData.get('secret'),
      hasResponse: !!verificationData.get('response'),
      hasRemoteIp: !!verificationData.get('remoteip'),
      dataLength: verificationData.toString().length
    });

    // Verify with Google's reCAPTCHA API
    console.log('🔍 Making request to Google reCAPTCHA API...');
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

    console.log('🔍 Google reCAPTCHA API response received:', {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    const { success, score, action, 'error-codes': errorCodes } = response.data;

    console.log('🔍 Parsed response data:', {
      success,
      score,
      action,
      hasErrorCodes: !!errorCodes,
      errorCodesCount: errorCodes ? errorCodes.length : 0,
      errorCodes: errorCodes || []
    });

    if (!success) {
      const errors = errorCodes?.join(', ') || 'Unknown error';
      console.warn('⚠️ reCAPTCHA verification failed:', { 
        errors, 
        token: token.substring(0, 10) + '...',
        fullResponse: response.data
      });
      return { success: false, score: 0, error: `Verification failed: ${errors}` };
    }

    // Log verification details (without sensitive data)
    console.log('✅ reCAPTCHA verification successful:', { 
      score, 
      action, 
      hostname: response.data.hostname,
      hasRemoteIp: !!remoteIp,
      scoreType: typeof score,
      actionType: typeof action,
      hostnameType: typeof response.data.hostname
    });

    return { success: true, score, action };
  } catch (error) {
    console.error('❌ reCAPTCHA verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      hasStack: error instanceof Error ? !!error.stack : false,
      stackLength: error instanceof Error ? error.stack?.length : 0
    });
    
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios error details:', {
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
  console.log(`🔍 reCAPTCHA score validation for ${action}:`, {
    score,
    threshold,
    scoreType: typeof score,
    thresholdType: typeof threshold,
    isNumber: !isNaN(score),
    isFinite: isFinite(score),
    scoreRange: score >= 0 && score <= 1 ? 'valid' : 'out of range'
  });

  const isAcceptable = score >= threshold;
  
  console.log(`🔍 reCAPTCHA score check for ${action}:`, {
    score,
    threshold,
    isAcceptable,
    difference: score - threshold,
    recommendation: score < 0.3 ? 'likely bot' : score < 0.7 ? 'suspicious' : 'likely human'
  });

  return isAcceptable;
}
