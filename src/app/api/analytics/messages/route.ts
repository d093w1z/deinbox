import { db } from '@/lib/db';
import type { MessageRow } from '@/lib/message-row';
import { mapMessageRowToEmail } from '@/lib/message-row';
import { parseSearchQuery } from '@/lib/search-query';
import { EmailSchema } from '@/types/EmailSchema';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MessagesResponseSchema = z.object({
    emails: z.array(EmailSchema),
    total: z.number(),
});

const UserIdSchema = z.object({ id: z.string().uuid() });

interface MessageRowWithCount extends MessageRow {
    total_count: string;
}

const SORTABLE_COLUMNS: Record<string, string> = {
    date: 'date',
    from: 'sender_email',
    subject: 'subject',
    category: 'category',
    isUnread: 'is_unread',
    size: 'size_bytes',
};

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = searchParams.get('days');
    const direction =
        searchParams.get('direction') === 'older' ? 'older' : 'newer';
    const category = searchParams.get('category');
    const hasAttachment = searchParams.get('hasAttachment') === 'true';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const q = searchParams.get('q')?.trim();
    const sender = searchParams.get('sender')?.trim();
    const label = searchParams.get('label')?.trim();
    const ids = searchParams.get('ids')?.trim();
    const limit = Math.min(
        Number(searchParams.get('limit') ?? '50') || 50,
        1000,
    );
    const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
    const sortColumn =
        SORTABLE_COLUMNS[searchParams.get('sort') ?? ''] ?? 'date';
    const sortDir =
        searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

    const parsed = q ? parseSearchQuery(q) : null;

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

        const conditions = ['user_id = $1'];
        const params: (string | number | string[])[] = [users[0].id];

        if (days !== null) {
            params.push(Number(days));
            conditions.push(
                direction === 'newer'
                    ? `date >= NOW() - ($${params.length} || ' days')::interval`
                    : `date < NOW() - ($${params.length} || ' days')::interval`,
            );
        }

        if (category && category !== 'all') {
            params.push(category);
            conditions.push(`category = $${params.length}`);
        }
        if (hasAttachment) {
            conditions.push('has_attachment = true');
        }
        if (unreadOnly) {
            conditions.push('is_unread = true');
        }
        if (sender) {
            params.push(sender);
            conditions.push(`sender_email = $${params.length}`);
        }
        if (label) {
            params.push(label);
            conditions.push(`$${params.length} = ANY(labels)`);
        }
        if (ids) {
            params.push(ids.split(',').filter(Boolean));
            conditions.push(`gmail_message_id = ANY($${params.length})`);
        }

        // Operators parsed out of the free-text search box (from:,
        // subject:, has:attachment, is:unread/read/starred, before:,
        // after:, older_than:, newer_than:, category:, label:). These
        // combine with the explicit query params above via AND.
        if (parsed) {
            if (parsed.from) {
                params.push(`%${parsed.from}%`);
                const i = params.length;
                conditions.push(
                    `(sender_email ILIKE $${i} OR sender_name ILIKE $${i})`,
                );
            }
            if (parsed.subject) {
                params.push(`%${parsed.subject}%`);
                conditions.push(`subject ILIKE $${params.length}`);
            }
            if (parsed.hasAttachment) {
                conditions.push('has_attachment = true');
            }
            if (parsed.isUnread) {
                conditions.push('is_unread = true');
            }
            if (parsed.isRead) {
                conditions.push('is_unread = false');
            }
            if (parsed.isStarred) {
                conditions.push(`'STARRED' = ANY(labels)`);
            }
            if (parsed.before) {
                params.push(parsed.before);
                conditions.push(`date < $${params.length}::date`);
            }
            if (parsed.after) {
                params.push(parsed.after);
                conditions.push(`date >= $${params.length}::date`);
            }
            if (parsed.olderThanDays) {
                params.push(parsed.olderThanDays);
                conditions.push(
                    `date < NOW() - ($${params.length} || ' days')::interval`,
                );
            }
            if (parsed.newerThanDays) {
                params.push(parsed.newerThanDays);
                conditions.push(
                    `date >= NOW() - ($${params.length} || ' days')::interval`,
                );
            }
            if (parsed.category) {
                params.push(parsed.category);
                conditions.push(`category = $${params.length}`);
            }
            if (parsed.label) {
                params.push(parsed.label.toUpperCase());
                conditions.push(`$${params.length} = ANY(labels)`);
            }
            if (parsed.freeText) {
                params.push(`%${parsed.freeText}%`);
                const i = params.length;
                conditions.push(
                    `(subject ILIKE $${i} OR sender_email ILIKE $${i} OR sender_name ILIKE $${i} OR snippet ILIKE $${i})`,
                );
            }
        }

        params.push(limit, (page - 1) * limit);

        const result = await db.query<MessageRowWithCount>(
            `SELECT
                gmail_message_id, gmail_thread_id, subject, sender_email,
                sender_name, recipient_emails, date, snippet, size_bytes,
                labels, category, is_unread, has_attachment,
                COUNT(*) OVER() AS total_count
             FROM email_messages
             WHERE ${conditions.join(' AND ')}
             ORDER BY ${sortColumn} ${sortDir}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );

        const emails = result.rows.map(mapMessageRowToEmail);

        const total = Number(result.rows[0]?.total_count ?? 0);

        const response = MessagesResponseSchema.parse({ emails, total });
        return NextResponse.json(response);
    } catch (error) {
        console.error('Failed to get message analytics:', error);
        return NextResponse.json(
            { error: 'Failed to get message analytics' },
            { status: 500 },
        );
    }
}
