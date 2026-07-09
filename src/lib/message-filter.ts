import { db } from '@/lib/db';
import { getCacheService } from '@/lib/redis';
import { parseSearchQuery } from '@/lib/search-query';

interface PreviewSet {
    userId: string;
    messageIds: string[];
}

export interface MessageFilterParams {
    days?: string | null;
    direction?: 'older' | 'newer';
    category?: string | null;
    hasAttachment?: boolean;
    unreadOnly?: boolean;
    q?: string;
    sender?: string;
    label?: string;
    previewId?: string;
}

export interface MessageFilter {
    conditions: string[];
    values: (string | number | string[])[];
}

// Builds the WHERE-clause conditions/params for filtering a user's
// email_messages — shared by /api/analytics/messages (paginated browse)
// and the filter-based bulk action path (POST /api/gmail/bulk-action),
// which needs to resolve *every* matching message, not just one page, so
// it re-runs this same filter server-side instead of trusting whatever
// happens to be loaded in the browser.
export async function buildMessageFilter(
    userId: string,
    params: MessageFilterParams,
): Promise<MessageFilter> {
    const conditions = ['user_id = $1'];
    const values: (string | number | string[])[] = [userId];

    if (params.days != null) {
        values.push(Number(params.days));
        conditions.push(
            (params.direction ?? 'newer') === 'newer'
                ? `date >= NOW() - ($${values.length} || ' days')::interval`
                : `date < NOW() - ($${values.length} || ' days')::interval`,
        );
    }

    if (params.category && params.category !== 'all') {
        values.push(params.category);
        conditions.push(`category = $${values.length}`);
    }
    if (params.hasAttachment) {
        conditions.push('has_attachment = true');
    }
    if (params.unreadOnly) {
        conditions.push('is_unread = true');
    }
    if (params.sender) {
        values.push(params.sender);
        conditions.push(`sender_email = $${values.length}`);
    }
    if (params.label) {
        values.push(params.label);
        conditions.push(`$${values.length} = ANY(labels)`);
    }
    if (params.previewId) {
        const preview = await getCacheService().get<PreviewSet>(
            `email-preview:${params.previewId}`,
        );
        if (preview && preview.userId === userId) {
            values.push(preview.messageIds);
            conditions.push(`gmail_message_id = ANY($${values.length})`);
        } else {
            // Expired/unknown token, or it belongs to a different user
            // (shouldn't happen, but never fall through to an unfiltered
            // set) — just match zero rows rather than guessing.
            conditions.push('false');
        }
    }

    // Operators parsed out of the free-text search box (from:, subject:,
    // has:attachment, is:unread/read/starred, before:, after:,
    // older_than:, newer_than:, category:, label:). These combine with
    // the explicit params above via AND.
    const parsed = params.q ? parseSearchQuery(params.q) : null;
    if (parsed) {
        if (parsed.from) {
            values.push(`%${parsed.from}%`);
            const i = values.length;
            conditions.push(
                `(sender_email ILIKE $${i} OR sender_name ILIKE $${i})`,
            );
        }
        if (parsed.subject) {
            values.push(`%${parsed.subject}%`);
            conditions.push(`subject ILIKE $${values.length}`);
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
            values.push(parsed.before);
            conditions.push(`date < $${values.length}::date`);
        }
        if (parsed.after) {
            values.push(parsed.after);
            conditions.push(`date >= $${values.length}::date`);
        }
        if (parsed.olderThanDays) {
            values.push(parsed.olderThanDays);
            conditions.push(
                `date < NOW() - ($${values.length} || ' days')::interval`,
            );
        }
        if (parsed.newerThanDays) {
            values.push(parsed.newerThanDays);
            conditions.push(
                `date >= NOW() - ($${values.length} || ' days')::interval`,
            );
        }
        if (parsed.category) {
            values.push(parsed.category);
            conditions.push(`category = $${values.length}`);
        }
        if (parsed.label) {
            values.push(parsed.label.toUpperCase());
            conditions.push(`$${values.length} = ANY(labels)`);
        }
        if (parsed.freeText) {
            values.push(`%${parsed.freeText}%`);
            const i = values.length;
            conditions.push(
                `(subject ILIKE $${i} OR sender_email ILIKE $${i} OR sender_name ILIKE $${i} OR snippet ILIKE $${i})`,
            );
        }
    }

    return { conditions, values };
}

// Resolves every gmail_message_id matching a filter — no LIMIT. Used by
// the "select all N matching this filter" bulk action path, capped at a
// safety ceiling so a runaway filter can't try to bulk-act on an entire
// mailbox in one call.
const MAX_FILTER_RESOLVE = 20000;

export async function resolveFilteredMessageIds(
    userId: string,
    params: MessageFilterParams,
): Promise<string[]> {
    const { conditions, values } = await buildMessageFilter(userId, params);

    const result = await db.query<{ gmail_message_id: string }>(
        `SELECT gmail_message_id
         FROM email_messages
         WHERE ${conditions.join(' AND ')}
         LIMIT ${MAX_FILTER_RESOLVE}`,
        values,
    );

    return result.rows.map((r) => r.gmail_message_id);
}
