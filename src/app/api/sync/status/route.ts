import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import type { EmailSyncJob } from '@/jobs/email-sync.queue';

export async function GET(_req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await db.query<EmailSyncJob>(
            `SELECT sj.*
             FROM sync_jobs sj
             JOIN users u ON sj.user_id = u.id
             WHERE u.email = $1
               AND sj.job_type IN ('full_sync', 'incremental_sync')
             ORDER BY sj.created_at DESC
             LIMIT 1`,
            [session.user.email],
        );

        if (!result.rows[0]) {
            return NextResponse.json(
                {
                    code: 'JOB_NOT_FOUND',
                    message: 'Job not found',
                    userAction: {
                        label: 'Start Sync',
                        action: '/sync-status', // Frontend can interpret this to redirect user
                    },
                },
                { status: 404 },
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Failed to get job status:', error);
        return NextResponse.json(
            { error: 'Failed to get status' },
            { status: 500 },
        );
    }
}
