import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getGmailService } from '@/lib/gmail';
import type { MessageFilterParams } from '@/lib/message-filter';
import { resolveFilteredMessageIds } from '@/lib/message-filter';
import { getCacheService } from '@/lib/redis';
import { EmailSyncService } from '@/services/email-sync.service';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const emailSyncService = new EmailSyncService();

type BulkAction = 'delete' | 'archive' | 'undelete' | 'unarchive';
type BulkGmailMethod =
    | 'deleteMessages'
    | 'undeleteMessages'
    | 'archiveMessages'
    | 'unarchiveMessages';

// 'delete' moves to Trash (removes INBOX, adds TRASH) rather than
// permanently deleting — see the comment on GmailService.deleteMessages
// for why. 'undelete'/'unarchive' are this route's undo counterparts.
// Each SQL fragment keeps the synced Postgres copy of `labels` in sync
// with the same label change just made against live Gmail, guarding
// against double-adding a label that's already present.
const ACTIONS: Record<
    BulkAction,
    { gmail: BulkGmailMethod; labelSql: string }
> = {
    delete: {
        gmail: 'deleteMessages',
        labelSql: `array_remove(labels, 'INBOX') || CASE WHEN 'TRASH' = ANY(labels) THEN ARRAY[]::text[] ELSE ARRAY['TRASH'] END`,
    },
    undelete: {
        gmail: 'undeleteMessages',
        labelSql: `array_remove(labels, 'TRASH') || CASE WHEN 'INBOX' = ANY(labels) THEN ARRAY[]::text[] ELSE ARRAY['INBOX'] END`,
    },
    archive: {
        gmail: 'archiveMessages',
        labelSql: `array_remove(labels, 'INBOX')`,
    },
    unarchive: {
        gmail: 'unarchiveMessages',
        labelSql: `labels || CASE WHEN 'INBOX' = ANY(labels) THEN ARRAY[]::text[] ELSE ARRAY['INBOX'] END`,
    },
};

interface BulkActionBody {
    action?: string;
    messageIds?: unknown;
    // "Select all N matching this filter" — resolved into a concrete id
    // list server-side (below) instead of the client having to fetch and
    // hold every matching id itself just to send it back.
    filter?: MessageFilterParams;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as BulkActionBody;
    const { action, messageIds: requestedIds, filter } = body;

    if (
        !action ||
        !(action in ACTIONS) ||
        (!Array.isArray(requestedIds) && !filter)
    ) {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 },
        );
    }

    const userResult = await db.query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [session.user.email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const messageIds = filter
        ? await resolveFilteredMessageIds(userId, filter)
        : (requestedIds as string[]);

    if (messageIds.length === 0) {
        return NextResponse.json({
            success: true,
            processed: 0,
            messageIds: [],
        });
    }

    const { gmail: gmailMethod, labelSql } = ACTIONS[action as BulkAction];
    const gmail = await getGmailService();
    await gmail[gmailMethod](messageIds);

    const cache = getCacheService();
    await cache.invalidateUserCache(session.user.email);

    // Keep the synced Postgres copy consistent with the mutation that just
    // happened against live Gmail, so analytics-backed pages don't show
    // stale rows until the next scheduled sync.
    await db.query(
        `UPDATE email_messages SET labels = ${labelSql} WHERE user_id = $1 AND gmail_message_id = ANY($2)`,
        [userId, messageIds],
    );
    await emailSyncService.computeSenderStats(userId);

    // Returned so the client can offer "Undo" without having to already
    // know the full id list itself — important for the filter-resolved
    // path, where it never did.
    return NextResponse.json({
        success: true,
        processed: messageIds.length,
        messageIds,
    });
}
