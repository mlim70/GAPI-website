import jwt from 'jsonwebtoken';

const SECRET = process.env.NEWSLETTER_JWT_SECRET!;
type Payload = { email: string; k: 'newsletter' };

export function createNewsletterToken(email: string, ttlMinutes = 30) {
  return jwt.sign({ email: email.toLowerCase(), k: 'newsletter' } as Payload, SECRET, {
    expiresIn: `${ttlMinutes}m`,
  });
}

export function verifyNewsletterToken(token: string) {
  const p = jwt.verify(token, SECRET) as Payload;
  if (p.k !== 'newsletter') throw new Error('Invalid token kind');
  return p.email;
}

export function createUnsubscribeToken(email: string, ttlMinutes = 60) {
  return jwt.sign({ email: email.toLowerCase(), k: 'unsubscribe' } as Payload, SECRET, {
    expiresIn: `${ttlMinutes}m`,
  });
}

export function verifyUnsubscribeToken(token: string) {
  const p = jwt.verify(token, SECRET) as Payload;
  if (p.k !== 'unsubscribe') throw new Error('Invalid token kind');
  return p.email;
}
