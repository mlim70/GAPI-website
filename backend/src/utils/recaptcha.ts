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
    // Prepare the verification request
    const secretKey = getRecaptchaSecretKey();
    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp })
    });

    // Verify with Google's reCAPTCHA API
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

    const { success, score, action, 'error-codes': errorCodes } = response.data;

    if (!success) {
      const errors = errorCodes?.join(', ') || 'Unknown error';
      console.warn('⚠️ reCAPTCHA verification failed:', { errors, token: token.substring(0, 10) + '...' });
      return { success: false, score: 0, error: `Verification failed: ${errors}` };
    }

    // Log verification details (without sensitive data)
    console.log('✅ reCAPTCHA verification successful:', { 
      score, 
      action, 
      hostname: response.data.hostname,
      hasRemoteIp: !!remoteIp
    });

    return { success: true, score, action };
  } catch (error) {
    console.error('❌ reCAPTCHA verification error:', error);
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
  const isAcceptable = score >= threshold;
  
  console.log(`🔍 reCAPTCHA score check for ${action}:`, {
    score,
    threshold,
    isAcceptable,
    recommendation: score < 0.3 ? 'likely bot' : score < 0.7 ? 'suspicious' : 'likely human'
  });

  return isAcceptable;
}
