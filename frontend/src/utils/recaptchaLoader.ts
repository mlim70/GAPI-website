// Utility to dynamically load reCAPTCHA script
export const loadRecaptchaScript = (siteKey: string, maxRetries: number = 3): Promise<void> => {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    
    const attemptLoad = () => {
      // Check if reCAPTCHA is already loaded
      if (window.grecaptcha) {
        resolve();
        return;
      }

      // Check if script is already being loaded
      if (document.querySelector('script[src*="recaptcha"]')) {
        // Wait for it to load
        const checkInterval = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      // Create and load the script
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Wait for grecaptcha to be available
        const checkInterval = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`⚠️ reCAPTCHA script load timeout, retrying (${retryCount}/${maxRetries})...`);
            attemptLoad();
          } else {
            reject(new Error('reCAPTCHA script load timeout after multiple retries'));
          }
        }, 10000);
      };
      
      script.onerror = () => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`⚠️ reCAPTCHA script load failed, retrying (${retryCount}/${maxRetries})...`);
          setTimeout(attemptLoad, 1000 * retryCount); // Exponential backoff
        } else {
          reject(new Error('Failed to load reCAPTCHA script after multiple retries'));
        }
      };

      document.head.appendChild(script);
    };
    
    attemptLoad();
  });
};
