import { db } from '@/lib/db';
import { enqueueSyncJob, PRIORITY } from '@/jobs/email-sync.queue';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userResult = await db.query<{ id: string }>(
            'SELECT id FROM users WHERE email = $1',
            [session.user.email],
        );
        if (!userResult.rows[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }
        const userId = userResult.rows[0].id;

        // Same stale-job auto-recovery as /api/sync/start: a job stuck in
        // pending/processing for hours means the worker died, not that
        // work is genuinely still running.
        await db.query(
            `UPDATE sync_jobs
             SET status = 'failed',
                 error_message = 'Stale job auto-cancelled (no progress for 3+ hours)',
                 completed_at = NOW()
             WHERE user_id = $1
               AND status IN ('pending', 'processing')
               AND created_at < NOW() - INTERVAL '3 hours'`,
            [userId],
        );

        const activeJob = await db.query<{ job_type: string }>(
            `SELECT job_type FROM sync_jobs
             WHERE user_id = $1 AND status IN ('pending', 'processing')
             LIMIT 1`,
            [userId],
        );
        if (activeJob.rows[0]) {
            const isSuggestions = activeJob.rows[0].job_type === 'suggestions';
            return NextResponse.json(
                {
                    error: isSuggestions
                        ? 'Suggestions are already being generated'
                        : 'A sync is currently in progress; try again once it finishes',
                },
                { status: 409 },
            );
        }

        // The unique partial index on sync_jobs(user_id) WHERE status IN
        // ('pending','processing') is the real guarantee against a race
        // between two concurrent requests; the check above is just for a
        // clearer error message in the common case.
        let jobId: string;
        try {
            const jobResult = await db.query<{ id: string }>(
                `INSERT INTO sync_jobs (user_id, job_type, status)
                 VALUES ($1, 'suggestions', 'pending') RETURNING id`,
                [userId],
            );
            jobId = jobResult.rows[0].id;
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                return NextResponse.json(
                    { error: 'A background job is already in progress' },
                    { status: 409 },
                );
            }
            throw error;
        }

        await enqueueSyncJob(userId, 'suggestions', jobId, PRIORITY.NORMAL);

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Suggestions generation started in background',
        });
    } catch (error) {
        console.error('Failed to start suggestions generation:', error);
        return NextResponse.json(
            { error: 'Failed to start suggestions generation' },
            { status: 500 },
        );
    }
}
