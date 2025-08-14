// recaptchaLoader.ts
export function loadRecaptcha(siteKey: string) {
  return new Promise<typeof window.grecaptcha>((resolve, reject) => {
    if (!siteKey) return reject(new Error('Missing site key'));
    if (typeof window !== 'undefined' && window.grecaptcha) return resolve(window.grecaptcha);

    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
    document.head.appendChild(s);
  });
}
