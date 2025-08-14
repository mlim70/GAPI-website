import jwt from 'jsonwebtoken';

type Payload = { email: string; k: 'newsletter' | 'unsubscribe' };

// Lazy loading function for the secret
function getSecret(): string {
  const secret = process.env.NEWSLETTER_JWT_SECRET;
  if (!secret) {
    throw new Error('NEWSLETTER_JWT_SECRET environment variable is required');
  }
  return secret;
}

export function createNewsletterToken(email: string, ttlMinutes = 30) {
  const secret = getSecret();
  return jwt.sign({ email: email.toLowerCase(), k: 'newsletter' } as Payload, secret, {
    expiresIn: `${ttlMinutes}m`,
  });
}

export function verifyNewsletterToken(token: string) {
  const secret = getSecret();
  const p = jwt.verify(token, secret) as Payload;
  if (p.k !== 'newsletter') throw new Error('Invalid token kind');
  return p.email;
}

export function createUnsubscribeToken(email: string, ttlMinutes = 60) {
  const secret = getSecret();
  return jwt.sign({ email: email.toLowerCase(), k: 'unsubscribe' } as Payload, secret, {
    expiresIn: `${ttlMinutes}m`,
  });
}

export function verifyUnsubscribeToken(token: string) {
  const secret = getSecret();
  const p = jwt.verify(token, secret) as Payload;
  if (p.k !== 'unsubscribe') throw new Error('Invalid token kind');
  return p.email;
}
