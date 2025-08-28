import { useCallback, useRef } from 'react';
import { loadRecaptcha } from '../utils/recaptchaLoader';
import { logger } from '../utils/logger';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface UseRecaptchaOptions {
  siteKey: string;
  action: string;
}

export const useRecaptcha = ({ siteKey, action }: UseRecaptchaOptions) => {
  // Track the last token for reference (optional)
  const lastTokenRef = useRef<string | null>(null);
  const lastTokenTimeRef = useRef<number>(0);

  const executeRecaptcha = useCallback(async (): Promise<string> => {
    if (!siteKey) throw new Error('reCAPTCHA site key not configured');

    const grecaptcha = await loadRecaptcha(siteKey);

    return new Promise((resolve, reject) => {
      grecaptcha.ready(async () => {
        try {
          const token = await grecaptcha.execute(siteKey, { action });
          
          // Store token info for reference (optional: keep, but don't time-gate)
          lastTokenRef.current = token;
          lastTokenTimeRef.current = Date.now();
          
          logger.info('✅ reCAPTCHA token generated successfully');
          resolve(token);
        } catch (err) {
          reject(new Error(`reCAPTCHA execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      });
    });
  }, [siteKey, action]);

  // Function to clear token cache (useful for retries)
  const clearTokenCache = useCallback(() => {
    lastTokenRef.current = null;
    lastTokenTimeRef.current = 0;
  }, []);

  return { executeRecaptcha, clearTokenCache };
};
