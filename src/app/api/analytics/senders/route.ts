import { db } from '@/lib/db';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UserIdSchema = z.object({ id: z.string().uuid() });

interface SenderRow {
    sender_email: string;
    sender_name: string | null;
    total_emails: number;
    unread_count: number;
    total_size_bytes: string | number;
    last_email_date: Date;
    has_unsubscribe: boolean;
    unsubscribe_url: string | null;
    message_ids: string[];
}

export async function GET(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cache = getCacheService();
    const cacheKey = `analytics:senders:${session.user.email}`;

    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

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

        const senders = await db.query<SenderRow>(
            `SELECT
                s.sender_email,
                s.sender_name,
                s.total_emails,
                s.unread_count,
                s.total_size_bytes,
                s.last_email_date,
                s.has_unsubscribe,
                s.unsubscribe_url,
                COALESCE(
                    array_agg(m.gmail_message_id) FILTER (WHERE m.gmail_message_id IS NOT NULL),
                    '{}'
                ) AS message_ids
             FROM sender_stats s
             LEFT JOIN email_messages m
                ON m.user_id = s.user_id AND m.sender_email = s.sender_email
             WHERE s.user_id = $1
             GROUP BY s.id
             ORDER BY s.total_emails DESC`,
            [users[0].id],
        );

        const response = { senders: senders.rows };

        await cache.set(cacheKey, response, 300);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Failed to get sender analytics:', error);
        return NextResponse.json(
            { error: 'Failed to get sender analytics' },
            { status: 500 },
        );
    }
}
