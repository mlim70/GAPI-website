// backend/src/middleware/requireAuth.ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../utils/database/db';
import User from '../models/user.model';
import { JWT_SECRET } from '../config/env';
import { JwtPayload } from '../types/jwt';

declare global {
  namespace Express {
    interface Request { 
      auth?: JwtPayload;
      userId: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { iat?: number };
    await connectToDatabase();
    const user = await User.findById(decoded.id).select('_id status passwordUpdatedAt');

    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Invalidate tokens issued before the last password change
    // (iat is seconds since epoch; passwordUpdatedAt is Date)
    if (decoded.iat && user.passwordUpdatedAt) {
      const issuedAtMs = decoded.iat * 1000;
      if (issuedAtMs < new Date(user.passwordUpdatedAt).getTime()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    req.userId = user._id.toString();
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
