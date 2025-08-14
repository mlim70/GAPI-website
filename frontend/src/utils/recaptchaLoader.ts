// recaptchaLoader.ts
let recaptchaLoadPromise: Promise<typeof window.grecaptcha> | null = null;

export function loadRecaptcha(siteKey: string) {
  // Prevent multiple script loads by reusing the same promise
  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }

  recaptchaLoadPromise = new Promise<typeof window.grecaptcha>((resolve, reject) => {
    if (!siteKey) return reject(new Error('Missing site key'));
    
    // Check if already loaded
    if (typeof window !== 'undefined' && window.grecaptcha) {
      resolve(window.grecaptcha);
      return;
    }

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (existingScript) {
      // Wait for existing script to load
      const checkGrecaptcha = () => {
        if (window.grecaptcha) {
          resolve(window.grecaptcha);
        } else {
          setTimeout(checkGrecaptcha, 100);
        }
      };
      checkGrecaptcha();
      return;
    }

    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = () => {
      recaptchaLoadPromise = null; // Reset on error
      reject(new Error('Failed to load reCAPTCHA script'));
    };
    document.head.appendChild(s);
  });

  return recaptchaLoadPromise;
}
