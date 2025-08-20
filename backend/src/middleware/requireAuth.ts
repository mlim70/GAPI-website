// backend/src/middleware/requireAuth.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../utils/db';
import User from '../models/user.model';
import { JWT_SECRET } from '../config/env';

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

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    await connectToDatabase();
    const userDoc = await User.findById(decoded.id).select('_id status');
    if (!userDoc || userDoc.status !== 'ACTIVE') return res.status(403).json({ message: 'Account has been deactivated' });
    req.auth = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};
