import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.js';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!identifier || !password) {
      setError('Please enter your email/username and password.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await authApi.login({ identifier, password });
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-light">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md"
      >
        <h2 className="text-center text-2xl font-bold text-clay">Log In</h2>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        {/* Identifier */}
        <div>
          <label htmlFor="identifier" className="mb-1 block text-sm font-medium">
            Email or Username
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            className="w-full rounded border border-sand px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded border border-sand px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          disabled={loading}
          className="w-full rounded bg-clay py-2 font-semibold text-white transition hover:bg-clay/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
