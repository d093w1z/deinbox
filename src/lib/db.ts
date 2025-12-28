import type { QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

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
            process.env.NODE_ENV === 'production'
                ? { rejectUnauthorized: false }
                : false,
    });

// Reuse the pool on reload in dev
if (process.env.NODE_ENV !== 'production') {
    globalForPg.pgPool = pg;
}

/**
 * Helper for simple queries
 */
async function query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
): Promise<QueryResult<T>> {
    return await pg.query<T>(text, params);
}

async function upsertUser(user: {
    email: string;
    name: string;
    gmailId: string;
    image?: string | null;
    accessToken: string;
    refreshToken?: string;
}) {
    await query(
        `
        INSERT INTO users (email, name, gmail_id, image, access_token_encrypted, refresh_token_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            image = EXCLUDED.image,
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, users.refresh_token_encrypted)
    `,
        [
            user.email,
            user.name,
            user.gmailId,
            user.image,
            user.accessToken,
            user.refreshToken,
        ],
    );
}

export const db = {
    query,
    upsertUser,
};
