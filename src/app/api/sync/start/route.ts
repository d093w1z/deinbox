import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { enqueueSyncJob, PRIORITY } from '@/jobs/email-sync.queue';

export async function POST(_req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get user
        const userResult = await db.query<{ id: string; sync_status: string }>(
            'SELECT id, sync_status FROM users WHERE email = $1',
            [session.user.email],
        );

        if (!userResult.rows[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }

        const user = userResult.rows[0];

        // A job stuck in pending/processing for hours almost certainly
        // means the worker died mid-sync (e.g. a crash or restart) rather
        // than a sync that's genuinely still running. Auto-recover it so
        // one dead job doesn't permanently block this user from ever
        // syncing again (the unique index below only allows one
        // active job per user).
        await db.query(
            `UPDATE sync_jobs
             SET status = 'failed',
                 error_message = 'Stale job auto-cancelled (no progress for 3+ hours)',
                 completed_at = NOW()
             WHERE user_id = $1
               AND status IN ('pending', 'processing')
               AND created_at < NOW() - INTERVAL '3 hours'`,
            [user.id],
        );

        // Check if sync already in progress
        if (user.sync_status === 'syncing') {
            return NextResponse.json(
                { error: 'Sync already in progress' },
                { status: 409 },
            );
        }

        // Determine sync type
        const syncType =
            user.sync_status === 'completed' ? 'incremental' : 'full';

        // Create sync job record. A unique partial index on
        // sync_jobs(user_id) WHERE status IN ('pending','processing')
        // guarantees only one active job per user even under a race
        // between two concurrent requests.
        let jobId: string;
        try {
            const jobResult = await db.query<{ id: string }>(
                `INSERT INTO sync_jobs (user_id, job_type, status)
                 VALUES ($1, $2, 'pending') RETURNING id`,
                [
                    user.id,
                    syncType === 'full' ? 'full_sync' : 'incremental_sync',
                ],
            );
            jobId = jobResult.rows[0].id;
        } catch (error) {
            if ((error as { code?: string }).code === '23505') {
                return NextResponse.json(
                    { error: 'Sync already in progress' },
                    { status: 409 },
                );
            }
            throw error;
        }

        // Update user status
        await db.query('UPDATE users SET sync_status = $1 WHERE id = $2', [
            'syncing',
            user.id,
        ]);

        // Enqueue background job
        await enqueueSyncJob(user.id, syncType, jobId, PRIORITY.HIGH);

        return NextResponse.json({
            success: true,
            jobId,
            syncType,
            message: 'Sync started in background',
        });
    } catch (error) {
        console.error('Failed to start sync:', error);
        return NextResponse.json(
            { error: 'Failed to start sync' },
            { status: 500 },
        );
    }
}
