import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

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

        // Flip status out-of-band; the running sync (if any) polls for
        // this between batches rather than being killed, so data already
        // fetched this run stays in Postgres — cancelling only stops
        // further messages from being pulled in.
        const jobResult = await db.query<{ id: string }>(
            `UPDATE sync_jobs
             SET status = 'cancelled', error_message = 'Cancelled by user',
                 completed_at = NOW()
             WHERE user_id = $1
               AND status IN ('pending', 'processing')
             RETURNING id`,
            [userId],
        );

        if (!jobResult.rows[0]) {
            return NextResponse.json(
                { error: 'No active sync to cancel' },
                { status: 404 },
            );
        }

        await db.query('UPDATE users SET sync_status = $1 WHERE id = $2', [
            'cancelled',
            userId,
        ]);

        return NextResponse.json({
            success: true,
            jobId: jobResult.rows[0].id,
        });
    } catch (error) {
        console.error('Failed to cancel sync:', error);
        return NextResponse.json(
            { error: 'Failed to cancel sync' },
            { status: 500 },
        );
    }
}
