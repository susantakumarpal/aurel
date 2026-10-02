import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../config/db';
import { AuthenticatedRequest, jwtSecret } from '../middleware/authenticate';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password must be at most 72 bytes.'
  ),
});

const issueToken = (userId: number) =>
  jwt.sign({}, jwtSecret, { subject: String(userId), expiresIn: '7d' });

const validationError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(' ');

export const register = async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });

  try {
    const existing = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [parsed.data.email]
    );
    if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [parsed.data.email, passwordHash]
    );
    const user = result.rows[0] as { id: number; email: string };
    return res.status(201).json({ token: issueToken(user.id), user });
  } catch {
    return res.status(500).json({ error: 'We could not create your account. Please try again.' });
  }
};

export const login = async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });

  try {
    const result = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [parsed.data.email]
    );
    const user = result.rows[0] as { id: number; email: string; password_hash: string } | undefined;
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    return res.json({ token: issueToken(user.id), user: { id: user.id, email: user.email } });
  } catch {
    return res.status(500).json({ error: 'We could not sign you in. Please try again.' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const result = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (!result.rows.length) return res.status(401).json({ error: 'This account no longer exists.' });
    return res.json({ user: result.rows[0] });
  } catch {
    return res.status(500).json({ error: 'We could not load your account.' });
  }
};