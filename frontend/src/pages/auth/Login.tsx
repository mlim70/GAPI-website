import { FormEvent, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import TokenManager from '../../utils/tokenManager';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { RECAPTCHA_CONFIG } from '../../config/recaptcha';
import { logger } from '../../utils/logger';

export default function Login({ setUser }: { setUser: (user: any) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);
  
  // reCAPTCHA hook for login
  const { executeRecaptcha, clearTokenCache } = useRecaptcha({ 
    siteKey: RECAPTCHA_CONFIG.SITE_KEY, 
    action: RECAPTCHA_CONFIG.ACTIONS.LOGIN 
  });
  
  // Check if reCAPTCHA is properly configured
  if (!RECAPTCHA_CONFIG.SITE_KEY || RECAPTCHA_CONFIG.SITE_KEY === 'your_recaptcha_site_key_here') {
    logger.warn('⚠️ reCAPTCHA not configured - login will fail on backend');
  }

  const setErrorWithFocus = (message: string) => {
    setError(message);
    // Focus the error message after a brief delay to ensure it's rendered
    setTimeout(() => {
      errorRef.current?.focus();
    }, 100);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    
    if (!identifier || !password) {
      setErrorWithFocus('Please enter your email/username and password.');
      return;
    }
    
    setLoading(true);
    try {
      // Execute reCAPTCHA verification
      logger.info('🔍 Executing reCAPTCHA verification...');
      let recaptchaToken: string;
      try {
        recaptchaToken = await executeRecaptcha();
        logger.info('✅ reCAPTCHA token obtained');
      } catch (recaptchaError) {
        logger.error('❌ reCAPTCHA execution failed:', recaptchaError);
        clearTokenCache(); // Clear cache for retry
        
        // Provide helpful error message based on the error
        if (recaptchaError instanceof Error && recaptchaError.message.includes('site key not configured')) {
          throw new Error('reCAPTCHA is not configured. Please contact support.');
        } else if (recaptchaError instanceof Error && recaptchaError.message.includes('Failed to load reCAPTCHA script')) {
          throw new Error('reCAPTCHA failed to load. Please check your internet connection and try again.');
        } else {
          throw new Error('reCAPTCHA verification failed. Please try again.');
        }
      }

      // Clear any existing invalid tokens before attempting login
      TokenManager.clearInvalidToken();
      
      const { token, user, subscription } = await authApi.login({ identifier, password, recaptchaToken });
      logger.info('✅ Login successful, received token and user data');
      logger.info('🔑 Token received:', token ? 'Token exists' : 'No token');
      logger.info('👤 User data received:', user ? 'User data exists' : 'No user data');
      logger.info('💳 Subscription data received:', subscription ? 'Yes' : 'No');
      
      TokenManager.setToken(token);
      TokenManager.setUser(user);
      setUser(user);
      logger.info('💾 Token and user data stored in TokenManager');
      navigate('/');
    } catch (err: any) {
      logger.error('❌ Login failed:', err);
      logger.error('❌ Error message:', err.message);
      logger.error('❌ Error stack:', err.stack);
      setErrorWithFocus(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 page-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md"
      >
        <h2 className="text-center text-2xl font-bold text-red">Log In</h2>

        {error && (
          <div 
            ref={errorRef}
            className="text-center text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded-md"
            tabIndex={-1}
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* Identifier */}
        <div>
          <label htmlFor="identifier" className="mb-1 block text-sm font-medium">
            Email or Username *
          </label>
          <input
            id="identifier"
            type="text"
            required
            autoComplete="username"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password *
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 text-right">
            <Link 
              to="/reset-password" 
              className="text-sm text-red hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !identifier.trim() || !password.trim()}
          className="w-full rounded bg-red py-2 font-semibold text-white transition hover:bg-red/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <div className="text-center text-sm text-gray-600">
          <p>
            Want to join with a membership?{' '}
            <Link to="/become-a-member" className="text-red underline hover:no-underline">
              Become a member
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
