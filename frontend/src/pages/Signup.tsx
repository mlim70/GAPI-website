import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.js';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [levelKey, setLevelKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [levels, setLevels] = useState<{ key: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/membership-levels')
      .then(res => res.json())
      .then(data => {
        setLevels(data);
        if (data.length) setLevelKey(data[0].key);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (
      !email ||
      !username ||
      !password ||
      !confirmPassword ||
      !firstName ||
      !lastName
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agree) {
      setError('You must agree to the Terms & Privacy Policy.');
      return;
    }
    if (!levelKey) {
      setError('Please select a membership level.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await authApi.register({
        email,
        username,
        password,
        firstName,
        lastName,
        levelKey,
        profilePic,
      });
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
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md space-y-4">
        <h2 className="text-2xl font-bold text-center text-clay">Sign Up</h2>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium mb-1" htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium mb-1" htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          {/* Profile Picture and Membership Level */}
          <div className="col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="profilePic">Profile Picture (optional)</label>
                <div className="flex items-center gap-3">
                  <label htmlFor="profilePic" className="text-clay px-4 py-2 rounded cursor-pointer border border-sand hover:bg-sand/18 transition text-sm font-medium">
                    {profilePic ? 'Change File' : 'Choose File'}
                  </label>
                  <span className="text-sm text-gray-600 truncate max-w-xs">
                    {profilePic ? profilePic.name : 'No file chosen'}
                  </span>
                  <input
                    id="profilePic"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setProfilePic(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="levelKey">Membership Level</label>
                <select
                  id="levelKey"
                  className="w-full border border-sand rounded px-3 py-2"
                  value={levelKey}
                  onChange={e => setLevelKey(e.target.value)}
                  required
                >
                  <option value="">None</option>
                  {levels.map(level => (
                    <option key={level.key} value={level.key}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="w-full border border-sand rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-clay"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex items-center">
          <input
            id="agree"
            type="checkbox"
            className="mr-2 accent-clay"
            checked={agree}
            onChange={e => setAgree(e.target.checked)}
          />
          <label htmlFor="agree" className="text-sm">I agree to the <a href="/terms" className="underline text-clay">Terms</a> & <a href="/privacy" className="underline text-clay">Privacy Policy</a></label>
        </div>
        <button
          type="submit"
          className="w-full bg-clay text-white font-semibold py-2 rounded hover:bg-clay/90 transition"
          disabled={loading}
        >
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}
