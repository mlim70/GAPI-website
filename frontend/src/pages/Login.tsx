import { FormEvent, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.js';
import TokenManager from '../utils/tokenManager.js';

export default function Login({ setUser }: { setUser: (user: any) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);

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
      const { token, user } = await authApi.login({ identifier, password });
      TokenManager.setToken(token);
      TokenManager.setUser(user);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setErrorWithFocus(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md"
      >
        <h2 className="text-center text-2xl font-bold text-clay">Log In</h2>

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
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
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
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-clay py-2 font-semibold text-white transition hover:bg-clay/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>

        <div className="text-center text-sm text-gray-600">
          <p>
            Want to join with a membership?{' '}
            <a href="/become-a-member" className="text-clay underline hover:no-underline">
              Become a member
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
