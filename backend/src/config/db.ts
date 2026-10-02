import { query as mockQuery } from './mockDb';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = process.env.DATABASE_URL
	? new Pool({ connectionString: process.env.DATABASE_URL })
	: null;
let useMockStore = !pool;

export const query = async (text: string, params?: unknown[]) => {
	if (!pool || useMockStore) return mockQuery(text, params);

	try {
		return await pool.query(text, params as unknown[]);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		const connectionUnavailable = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET'].includes(code || '');
		if (process.env.NODE_ENV === 'production' || !connectionUnavailable) throw error;
		useMockStore = true;
		console.warn('PostgreSQL is unavailable; using the development in-memory store.');
		return mockQuery(text, params);
	}
};
