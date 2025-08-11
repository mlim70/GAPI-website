import { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { env } from '../../config/environment';

interface NewsletterSignupProps {
  variant?: 'inline' | 'card';
  className?: string;
  source?: string;
}

export default function NewsletterSignup({ 
  variant = 'inline', 
  className = '',
  source = 'footer'
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`${env.apiUrl}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });

      if (res.ok) {
        setStatus('sent');
        setEmail('');
      } else {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  if (variant === 'card') {
    return (
      <Card className={`max-w-md mx-auto ${className}`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red/10 rounded-full mb-4">
            <Mail className="w-8 h-8 text-red" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-dark mb-2">
            Stay Updated
          </h3>
          <p className="text-neutral-dark/70 text-sm">
            Get the latest GAPI news, events, and updates delivered to your inbox.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email address"
              className="w-full px-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-red focus:border-transparent transition-all duration-200 placeholder:text-neutral-dark/50"
              disabled={status === 'loading'}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={status === 'loading'}
            disabled={status === 'loading'}
          >
            Subscribe to Newsletter
          </Button>

          {status === 'sent' && (
            <div className="flex items-center justify-center space-x-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                Check your email to confirm your subscription!
              </span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                {errorMessage}
              </span>
            </div>
          )}
        </form>

        <p className="text-xs text-neutral-dark/50 text-center mt-4">
          We respect your privacy. Unsubscribe at any time.
        </p>
      </Card>
    );
  }

  // Inline variant
  return (
    <div className={`${className}`}>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
        <div className="flex-1">
          <label htmlFor="newsletter-email-inline" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email-inline"
            type="email"
            required
            value={email}
            onChange={handleEmailChange}
            placeholder="Enter your email"
            className="w-full px-4 py-2.5 border border-neutral-light rounded-lg focus:ring-2 focus:ring-red focus:border-transparent transition-all duration-200 placeholder:text-neutral-dark/50 text-sm"
            disabled={status === 'loading'}
          />
        </div>
        
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={status === 'loading'}
          disabled={status === 'loading'}
          className="whitespace-nowrap"
        >
          Subscribe
        </Button>
      </form>

      {status === 'sent' && (
        <div className="flex items-center space-x-2 text-green-700 mt-3">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            Check your email to confirm!
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center space-x-2 text-red-600 mt-3">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            {errorMessage}
          </span>
        </div>
      )}
    </div>
  );
}
