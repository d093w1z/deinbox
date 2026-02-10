import { db } from '@/lib/db';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UserIdSchema = z.object({ id: z.string().uuid() });

interface OverviewStats {
    total_emails: string | number;
    unread_count: string | number;
    total_size_bytes: string | number;
    unique_senders: string | number;
    oldest_email: Date;
    newest_email: Date;
}

interface TopSender {
    sender_email: string;
    sender_name: string | null;
    total_emails: number;
    unread_count: number;
    total_size_bytes: string | number;
}

interface CategoryBreakdown {
    category: string;
    count: string | number;
    size_bytes: string | number;
    unread_count: string | number;
}

interface StorageHistory {
    month: Date;
    category: string;
    count: string | number;
    size_bytes: string | number;
}

export async function GET(_req: NextRequest) {
    const session = await getServerSession();
    const cache = getCacheService();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cacheKey = `analysis:overview:${session.user.email}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
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

        const [overview, topSenders, categoryBreakdown, storageByCategory] =
            await Promise.all([
                db.query<OverviewStats>(
                    `SELECT
                        COUNT(*) AS total_emails,
                        SUM(CASE WHEN is_unread THEN 1 ELSE 0 END) AS unread_count,
                        COALESCE(SUM(size_bytes), 0) AS total_size_bytes,
                        COUNT(DISTINCT sender_email) AS unique_senders,
                        MIN(date) AS oldest_email,
                        MAX(date) AS newest_email
                     FROM email_messages
                     WHERE user_id = $1`,
                    [userId],
                ),

                db.query<TopSender>(
                    `SELECT
                        sender_email,
                        sender_name,
                        total_emails,
                        unread_count,
                        total_size_bytes
                     FROM sender_stats
                     WHERE user_id = $1
                     ORDER BY total_emails DESC
                     LIMIT 10`,
                    [userId],
                ),

                db.query<CategoryBreakdown>(
                    `SELECT
                        category,
                        COUNT(*) AS count,
                        COALESCE(SUM(size_bytes), 0) AS size_bytes,
                        SUM(CASE WHEN is_unread THEN 1 ELSE 0 END) AS unread_count
                     FROM email_messages
                     WHERE user_id = $1
                     GROUP BY category`,
                    [userId],
                ),

                db.query<StorageHistory>(
                    `SELECT
                        DATE_TRUNC('month', date) AS month,
                        category,
                        COUNT(*) AS count,
                        COALESCE(SUM(size_bytes), 0) AS size_bytes
                     FROM email_messages
                     WHERE user_id = $1
                     GROUP BY DATE_TRUNC('month', date), category
                     ORDER BY month DESC
                     LIMIT 100`,
                    [userId],
                ),
            ]);

        const response = {
            overview: overview.rows[0],
            topSenders: topSenders.rows,
            categoryBreakdown: categoryBreakdown.rows,
            storageByCategory: storageByCategory.rows,
        };

        await cache.set(cacheKey, response, 600);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Failed to get analysis:', error);
        return NextResponse.json(
            { error: 'Failed to get analysis' },
            { status: 500 },
        );
    }
}
