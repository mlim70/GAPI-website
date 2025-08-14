import { useCallback } from 'react';
import { loadRecaptcha } from '../utils/recaptchaLoader';

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
  const executeRecaptcha = useCallback(async (): Promise<string> => {
    if (!siteKey) throw new Error('reCAPTCHA site key not configured');

    const grecaptcha = await loadRecaptcha(siteKey);

    return new Promise((resolve, reject) => {
      grecaptcha.ready(async () => {
        try {
          const token = await grecaptcha.execute(siteKey, { action });
          console.log('✅ reCAPTCHA token generated successfully');
          resolve(token);
        } catch (err) {
          reject(new Error(`reCAPTCHA execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      });
    });
  }, [siteKey, action]);

  return { executeRecaptcha };
};
