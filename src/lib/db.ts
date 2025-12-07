import { Pool, QueryResult } from 'pg';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment variables.');
}

/**
 * Create a global connection pool to prevent creating
 * multiple connections during Next.js hot reload.
 */
const globalForPg = global as unknown as {
    pgPool?: Pool;
};

const pg =
    globalForPg.pgPool ||
    new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
            process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

// Reuse the pool on reload in dev
if (process.env.NODE_ENV !== 'production') {
    globalForPg.pgPool = pg;
}

/**
 * Helper for simple queries
 */
async function query(text: string, params?: any[], p0?: (err: any, res: any) => void): Promise<QueryResult> {
    console.log('Executing query:', text, params);
    const res = await pg.query(text, params);
    console.log('Query result:', res.rows);
    return res;
}
export const db = {
    query,
};
