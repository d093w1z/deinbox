import { db } from '@/lib/db';
import { updateJobStatus } from '@/lib/sync-job';
import type { MessageRow } from '@/lib/message-row';
import { mapMessageRowToEmail } from '@/lib/message-row';
import { AICategorizerService } from '@/lib/ai-categorizer';
import type { Email } from '@/types/EmailSchema';

const BATCH_SIZE = 2000;

function summarizeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export class SuggestionsService {
    // Analyzes the user's full synced inbox (not just whatever happens to
    // be on screen) and stores the result, rather than recomputing on
    // every page visit against a small live-Gmail snapshot.
    async generate(userId: string, jobId: string): Promise<void> {
        try {
            await updateJobStatus(jobId, 'processing', 0, 0);

            const countResult = await db.query<{ count: string }>(
                'SELECT COUNT(*) FROM email_messages WHERE user_id = $1',
                [userId],
            );
            const total = Number(countResult.rows[0]?.count ?? 0);

            await db.query(
                'UPDATE sync_jobs SET total_items = $1 WHERE id = $2',
                [total, jobId],
            );

            const emails: Email[] = [];
            let offset = 0;

            while (offset < total) {
                const batch = await db.query<MessageRow>(
                    `SELECT
                        gmail_message_id, gmail_thread_id, subject,
                        sender_email, sender_name, recipient_emails, date,
                        snippet, size_bytes, labels, category, is_unread,
                        has_attachment
                     FROM email_messages
                     WHERE user_id = $1
                     ORDER BY date DESC
                     LIMIT $2 OFFSET $3`,
                    [userId, BATCH_SIZE, offset],
                );

                emails.push(...batch.rows.map(mapMessageRowToEmail));
                offset += BATCH_SIZE;

                const progress =
                    total > 0
                        ? Math.min(Math.floor((offset / total) * 90), 90)
                        : 90;
                await updateJobStatus(
                    jobId,
                    'processing',
                    progress,
                    emails.length,
                );
            }

            const ai = new AICategorizerService();
            const result = {
                suggestions: ai.generateCleanupSuggestions(emails),
                smartFilters: ai.getSmartFilters(emails),
                generatedAt: new Date().toISOString(),
                emailsAnalyzed: emails.length,
            };

            await db.query(
                `INSERT INTO analysis_cache (user_id, cache_key, cache_data, expires_at)
                 VALUES ($1, 'suggestions', $2, NOW() + INTERVAL '30 days')
                 ON CONFLICT (user_id, cache_key) DO UPDATE SET
                    cache_data = EXCLUDED.cache_data,
                    expires_at = EXCLUDED.expires_at,
                    created_at = NOW()`,
                [userId, JSON.stringify(result)],
            );

            await updateJobStatus(jobId, 'completed', 100, emails.length);
        } catch (error) {
            console.error(
                `[suggestions ${jobId}] failed for user ${userId}: ${summarizeError(error)}`,
            );
            await updateJobStatus(
                jobId,
                'failed',
                0,
                undefined,
                summarizeError(error),
            );
            throw error;
        }
    }
}
