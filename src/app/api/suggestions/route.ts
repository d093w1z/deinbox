import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UserIdSchema = z.object({ id: z.string().uuid() });

interface CacheRow {
    cache_data: unknown;
    created_at: string;
}

interface JobRow {
    id: string;
    status: string;
    progress: number;
    total_items: number | null;
    processed_items: number;
    error_message: string | null;
    created_at: string;
}

// Reads the last generated suggestions result (from analysis_cache) plus
// the status of the most recent background job that produced it, rather
// than recomputing suggestions live on every page visit.
export async function GET(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userResult = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [session.user.email],
        );
        const users = UserIdSchema.array().parse(userResult.rows);

        if (!users[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }
        const userId = users[0].id;

        const [cacheResult, jobResult] = await Promise.all([
            db.query<CacheRow>(
                `SELECT cache_data, created_at FROM analysis_cache
                 WHERE user_id = $1 AND cache_key = 'suggestions'`,
                [userId],
            ),
            db.query<JobRow>(
                `SELECT id, status, progress, total_items, processed_items, error_message, created_at
                 FROM sync_jobs
                 WHERE user_id = $1 AND job_type = 'suggestions'
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [userId],
            ),
        ]);

        return NextResponse.json({
            result: cacheResult.rows[0]?.cache_data ?? null,
            job: jobResult.rows[0] ?? null,
        });
    } catch (error) {
        console.error('Failed to get suggestions:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestions' },
            { status: 500 },
        );
    }
}
