import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthenticatedRequest extends Request {
  userId: number;
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production.');
}

const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-before-deploying';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
    }
    (req as AuthenticatedRequest).userId = userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
};

export { jwtSecret };