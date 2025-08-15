// backend/src/middleware/requireAuth.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface JwtPayload {
  id: string;
  email?: string;
  username?: string;
  role?: 'admin' | 'member';
}

declare global {
  namespace Express {
    interface Request { auth?: JwtPayload; }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
