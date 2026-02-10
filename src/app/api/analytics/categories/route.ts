import { db } from '@/lib/db';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UserIdSchema = z.object({ id: z.string().uuid() });

interface CategoryRow {
    category: string;
    count: string | number;
    unread_count: string | number;
    total_size_bytes: string | number;
    message_ids: string[];
}

export async function GET(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cache = getCacheService();
    const cacheKey = `analytics:categories:${session.user.email}`;

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

        const categories = await db.query<CategoryRow>(
            `SELECT
                category,
                COUNT(*) AS count,
                SUM(CASE WHEN is_unread THEN 1 ELSE 0 END) AS unread_count,
                COALESCE(SUM(size_bytes), 0) AS total_size_bytes,
                array_agg(gmail_message_id) AS message_ids
             FROM email_messages
             WHERE user_id = $1
             GROUP BY category
             ORDER BY count DESC`,
            [users[0].id],
        );

        const response = { categories: categories.rows };

        await cache.set(cacheKey, response, 300);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Failed to get category analytics:', error);
        return NextResponse.json(
            { error: 'Failed to get category analytics' },
            { status: 500 },
        );
    }
}
