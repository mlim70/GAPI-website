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

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    await connectToDatabase();
    const user = await User.findById(decoded.id).select('_id status');

    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    (req as any).userId = user._id;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
