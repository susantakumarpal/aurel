import { Request, Response } from 'express';
import { query } from '../config/db';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
};
