// services/email-sync.service.ts
import type { gmail_v1 } from 'googleapis';

import { GmailService } from '../lib/gmail';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { refreshGoogleAccessToken } from '@/lib/google-oauth';
import { updateJobStatus } from '@/lib/sync-job';

function isRateLimitError(error: unknown): boolean {
    const err = error as { code?: number; message?: string } | undefined;
    if (err?.code === 429) return true;
    return err?.code === 403 && /quota|rate limit/i.test(err.message ?? '');
}

function isAuthError(error: unknown): boolean {
    const err = error as { code?: number } | undefined;
    return err?.code === 401;
}

// Transient, non-Gmail-specific network failures (DNS blips, connection
// resets/timeouts). Unlike a real API error, the request never reached
// Gmail at all, so retrying once the network recovers is almost always
// enough — a brief internet drop shouldn't fail the whole sync.
const TRANSIENT_NETWORK_ERROR_CODES = new Set([
    'EAI_AGAIN',
    'ENOTFOUND',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
]);

function isTransientNetworkError(error: unknown): boolean {
    const err = error as { code?: string } | undefined;
    return !!err?.code && TRANSIENT_NETWORK_ERROR_CODES.has(err.code);
}

// Thrown when a mid-sync token refresh itself fails (e.g. the refresh
// token was revoked). Unlike a single message failing to fetch, this
// means every remaining request will fail the same way, so it's treated
// as fatal for the whole sync rather than a per-message failure.
class TokenRefreshFailedError extends Error {}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeError(error: unknown): string {
    const err = error as { code?: number; message?: string } | undefined;
    if (err?.code || err?.message) {
        return `[${err.code ?? '?'}] ${err.message ?? String(error)}`;
    }
    return String(error);
}

export class EmailSyncService {
    private batchSize = 500; // Process in batches
    private concurrency = 5; // Parallel API requests
    private maxRetries = 4;

    // Dedupes concurrent mid-sync token refreshes: multiple in-flight
    // requests can all hit a 401 around the same time, but only one
    // refresh call should actually go out.
    private tokenRefreshPromise: Promise<string> | null = null;

    private async ensureFreshToken(
        gmail: GmailService,
        userId: string,
        refreshTokenEncrypted: string | null,
    ): Promise<string> {
        if (!refreshTokenEncrypted) {
            throw new TokenRefreshFailedError(
                'Access token expired and no refresh token is stored for this user',
            );
        }

        if (!this.tokenRefreshPromise) {
            this.tokenRefreshPromise = (async () => {
                try {
                    const refreshed = await refreshGoogleAccessToken(
                        decrypt(refreshTokenEncrypted),
                    );
                    await db.query(
                        'UPDATE users SET access_token_encrypted = $1 WHERE id = $2',
                        [encrypt(refreshed.accessToken), userId],
                    );
                    gmail.updateAccessToken(refreshed.accessToken);
                    return refreshed.accessToken;
                } catch (error) {
                    throw new TokenRefreshFailedError(
                        `Failed to refresh access token: ${summarizeError(error)}`,
                    );
                }
            })();
        }

        try {
            return await this.tokenRefreshPromise;
        } finally {
            this.tokenRefreshPromise = null;
        }
    }

    async performFullSync(userId: string, jobId: string): Promise<void> {
        let statusAlreadyFinalized = false;
        try {
            const user = await db.query('SELECT * FROM users WHERE id = $1', [
                userId,
            ]);

            if (!user.rows[0]) {
                throw new Error('User not found');
            }

            const refreshTokenEncrypted: string | null =
                user.rows[0].refresh_token_encrypted ?? null;

            const gmail = new GmailService(
                decrypt(user.rows[0].access_token_encrypted),
                userId,
            );

            // Update job status
            await updateJobStatus(jobId, 'processing', 0, 0);

            // Get total count first
            const profile = await gmail.getProfile();
            const totalMessages = profile.messagesTotal || 0;
            // Checkpoint captured *before* listing/fetching begins, so the
            // next incremental sync's history.list call also picks up any
            // changes that happened during this (potentially hour-long)
            // full sync — not just changes after it finished.
            const startHistoryId = profile.historyId ?? null;

            await db.query(
                'UPDATE sync_jobs SET total_items = $1 WHERE id = $2',
                [totalMessages, jobId],
            );

            let pageToken: string | undefined;
            let processedCount = 0;
            const messageIds: string[] = [];

            // Step 1: Fetch all message IDs (fast)
            do {
                const listResponse = await gmail.client.users.messages.list({
                    userId: 'me',
                    maxResults: 500,
                    pageToken,
                });

                if (listResponse.data.messages) {
                    messageIds.push(
                        ...listResponse.data.messages.map((m) => m.id!),
                    );
                }

                pageToken = listResponse.data.nextPageToken || undefined;

                processedCount += listResponse.data.messages?.length || 0;
                await updateJobStatus(
                    jobId,
                    'processing',
                    Math.floor((processedCount / totalMessages) * 50), // First 50%
                    processedCount,
                );
            } while (pageToken);

            // The profile's messagesTotal is an estimate that can drift
            // from the actual paginated count by the time listing
            // finishes. Reconcile total_items to the real count so
            // "processed of total" never overshoots for the rest of the
            // job.
            await db.query(
                'UPDATE sync_jobs SET total_items = $1 WHERE id = $2',
                [messageIds.length, jobId],
            );

            // Step 2: Batch fetch message details (with concurrency control)
            const { succeeded, failed } = await this.batchFetchAndStore(
                gmail,
                userId,
                messageIds,
                jobId,
                totalMessages,
                refreshTokenEncrypted,
            );

            // Step 3: Compute sender statistics
            await this.computeSenderStats(userId);

            if (failed > 0) {
                // Some messages never made it into Postgres (e.g. a token
                // refresh failure partway through, or requests that
                // exhausted their retries). Reflect that honestly instead
                // of marking the sync 'completed' — a caller checking
                // sync_status needs to know the data is incomplete.
                statusAlreadyFinalized = true;
                const progress =
                    messageIds.length > 0
                        ? Math.floor((succeeded / messageIds.length) * 100)
                        : 0;
                const message = `${failed} of ${messageIds.length} messages failed to sync`;

                await db.query(
                    'UPDATE users SET sync_status = $1, last_sync_at = NOW(), total_emails = $2, history_id = COALESCE($3, history_id) WHERE id = $4',
                    ['failed', succeeded, startHistoryId, userId],
                );
                await updateJobStatus(
                    jobId,
                    'failed',
                    progress,
                    succeeded,
                    message,
                );
                throw new Error(message);
            }

            // Update user sync status. The message *listing* completed
            // successfully by this point regardless of the failed count
            // above, so history_id is always safe to persist here — it
            // lets the next sync go incremental instead of re-listing and
            // re-fetching everything from scratch again.
            await db.query(
                'UPDATE users SET sync_status = $1, last_sync_at = NOW(), total_emails = $2, history_id = COALESCE($3, history_id) WHERE id = $4',
                ['completed', messageIds.length, startHistoryId, userId],
            );

            await updateJobStatus(jobId, 'completed', 100, messageIds.length);
        } catch (error) {
            console.error(
                `[sync ${jobId}] full sync failed for user ${userId}: ${summarizeError(error)}`,
            );
            if (!statusAlreadyFinalized) {
                await updateJobStatus(
                    jobId,
                    'failed',
                    0,
                    undefined,
                    (error as Error).message,
                );
                await db.query(
                    'UPDATE users SET sync_status = $1 WHERE id = $2',
                    ['failed', userId],
                );
            }
            throw error;
        }
    }

    async performIncrementalSync(userId: string, jobId: string): Promise<void> {
        try {
            const user = await db.query('SELECT * FROM users WHERE id = $1', [
                userId,
            ]);

            if (!user.rows[0] || !user.rows[0].history_id) {
                // No history ID, perform full sync instead
                return this.performFullSync(userId, jobId);
            }

            const refreshTokenEncrypted: string | null =
                user.rows[0].refresh_token_encrypted ?? null;

            const gmail = new GmailService(
                decrypt(user.rows[0].access_token_encrypted),
                userId,
            );

            await updateJobStatus(jobId, 'processing', 0, 0);

            // Get changes since last history ID
            const historyResponse = await gmail.client.users.history.list({
                userId: 'me',
                startHistoryId: user.rows[0].history_id,
                historyTypes: [
                    'messageAdded',
                    'messageDeleted',
                    'labelAdded',
                    'labelRemoved',
                ],
            });

            if (!historyResponse.data.history) {
                // No changes
                await updateJobStatus(jobId, 'completed', 100, 0);
                return;
            }

            const changes = historyResponse.data.history;
            let processedCount = 0;

            await db.query(
                'UPDATE sync_jobs SET total_items = $1 WHERE id = $2',
                [changes.length, jobId],
            );

            for (const change of changes) {
                // Handle added messages
                if (change.messagesAdded) {
                    for (const added of change.messagesAdded) {
                        await this.fetchAndStoreMessage(
                            gmail,
                            userId,
                            added.message!.id!,
                            refreshTokenEncrypted,
                        );
                    }
                }

                // Handle deleted messages
                if (change.messagesDeleted) {
                    for (const deleted of change.messagesDeleted) {
                        await db.query(
                            'DELETE FROM email_messages WHERE user_id = $1 AND gmail_message_id = $2',
                            [userId, deleted.message!.id!],
                        );
                    }
                }

                // Handle label changes
                if (change.labelsAdded || change.labelsRemoved) {
                    // Update labels for affected messages
                    await this.updateMessageLabels(userId, change);
                }

                processedCount++;
                await updateJobStatus(
                    jobId,
                    'processing',
                    Math.floor((processedCount / changes.length) * 100),
                    processedCount,
                );
            }

            // Update history ID
            await db.query(
                'UPDATE users SET history_id = $1, last_sync_at = NOW() WHERE id = $2',
                [historyResponse.data.historyId, userId],
            );

            await updateJobStatus(jobId, 'completed', 100, changes.length);
        } catch (error) {
            console.error(
                `[sync ${jobId}] incremental sync failed for user ${userId}: ${summarizeError(error)}`,
            );
            await updateJobStatus(
                jobId,
                'failed',
                0,
                undefined,
                (error as Error).message,
            );
            await db.query('UPDATE users SET sync_status = $1 WHERE id = $2', [
                'failed',
                userId,
            ]);
            throw error;
        }
    }

    private async batchFetchAndStore(
        gmail: GmailService,
        userId: string,
        messageIds: string[],
        jobId: string,
        totalMessages: number,
        refreshTokenEncrypted: string | null,
    ): Promise<{ succeeded: number; failed: number }> {
        const chunks = this.chunkArray(messageIds, this.batchSize);
        let processedTotal = 0;
        let succeeded = 0;
        let failed = 0;

        console.log(
            `[sync ${jobId}] fetching ${messageIds.length} messages (concurrency=${this.concurrency})`,
        );

        for (const chunk of chunks) {
            // Process with a real concurrency limit: each sub-chunk of
            // `concurrency` requests is awaited before the next one starts,
            // instead of firing every sub-chunk in the batch at once (which
            // used to burst hundreds of concurrent requests and blow
            // through Gmail's per-minute quota).
            for (const subChunk of this.chunkArray(chunk, this.concurrency)) {
                const results = await Promise.all(
                    subChunk.map((id) =>
                        this.fetchAndStoreMessage(
                            gmail,
                            userId,
                            id,
                            refreshTokenEncrypted,
                        ),
                    ),
                );
                succeeded += results.filter(Boolean).length;
                failed += results.filter((ok) => !ok).length;
                processedTotal += subChunk.length;

                // Write progress after every sub-chunk (~concurrency
                // items), not once per 500-item chunk. A 500-item chunk
                // can take well over a minute, and the frontend polls
                // every 5s — updating only once per chunk meant most
                // polls saw an unchanged processed_items, making the
                // live rate/ETA compute a zero delta and show as blank.
                const progress =
                    50 + Math.floor((processedTotal / messageIds.length) * 40); // 50-90%
                await updateJobStatus(
                    jobId,
                    'processing',
                    progress,
                    processedTotal,
                );
            }

            console.log(
                `[sync ${jobId}] progress ${processedTotal}/${messageIds.length} (${succeeded} ok, ${failed} failed)`,
            );
        }

        console.log(
            `[sync ${jobId}] fetch complete: ${succeeded} succeeded, ${failed} failed of ${messageIds.length}`,
        );

        return { succeeded, failed };
    }

    private async fetchAndStoreMessage(
        gmail: GmailService,
        userId: string,
        messageId: string,
        refreshTokenEncrypted: string | null,
    ): Promise<boolean> {
        try {
            let attempt = 0;
            let refreshedOnce = false;
            let messageResponse;
            for (;;) {
                try {
                    messageResponse = await gmail.client.users.messages.get({
                        userId: 'me',
                        id: messageId,
                        format: 'full',
                    });
                    break;
                } catch (error) {
                    if (isAuthError(error) && !refreshedOnce) {
                        // Access token expired mid-sync. Refresh it and
                        // retry this same request once — the outer
                        // ensureFreshToken dedupes so concurrent requests
                        // hitting a 401 at the same time only trigger one
                        // refresh call.
                        refreshedOnce = true;
                        console.warn(
                            `[sync] access token expired fetching ${messageId}, refreshing`,
                        );
                        await this.ensureFreshToken(
                            gmail,
                            userId,
                            refreshTokenEncrypted,
                        );
                        continue;
                    }
                    const rateLimited = isRateLimitError(error);
                    const transientNetwork = isTransientNetworkError(error);
                    if (
                        (!rateLimited && !transientNetwork) ||
                        attempt >= this.maxRetries
                    ) {
                        throw error;
                    }
                    const delayMs = 1000 * 2 ** attempt;
                    console.warn(
                        `[sync] ${rateLimited ? 'rate limited' : 'transient network error'} fetching ${messageId}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
                    );
                    await sleep(delayMs);
                    attempt++;
                }
            }

            const message = messageResponse.data;
            const headers = message.payload?.headers || [];

            const getHeader = (name: string) =>
                headers.find(
                    (h: any) => h.name?.toLowerCase() === name.toLowerCase(),
                )?.value || '';

            const labels = message.labelIds || [];
            let category = 'primary';
            if (labels.includes('CATEGORY_SOCIAL')) category = 'social';
            else if (labels.includes('CATEGORY_PROMOTIONS'))
                category = 'promotions';
            else if (labels.includes('CATEGORY_UPDATES')) category = 'updates';
            else if (labels.includes('CATEGORY_FORUMS')) category = 'forums';

            const sender = getHeader('from');
            const senderEmail = this.extractEmail(sender);
            const senderName = this.extractName(sender);

            // Store message
            await db.query(
                `INSERT INTO email_messages (
                    user_id, gmail_message_id, gmail_thread_id, subject,
                    sender_email, sender_name, recipient_emails, date,
                    snippet, size_bytes, labels, category,
                    is_unread, has_attachment, is_starred, is_important,
                    raw_headers
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (user_id, gmail_message_id) DO UPDATE SET
                    labels = EXCLUDED.labels,
                    is_unread = EXCLUDED.is_unread,
                    is_starred = EXCLUDED.is_starred`,
                [
                    userId,
                    message.id,
                    message.threadId,
                    getHeader('subject'),
                    senderEmail,
                    senderName,
                    [getHeader('to')],
                    new Date(parseInt(message.internalDate!)),
                    message.snippet,
                    message.sizeEstimate,
                    labels,
                    category,
                    labels.includes('UNREAD'),
                    this.hasAttachment(message.payload!),
                    labels.includes('STARRED'),
                    labels.includes('IMPORTANT'),
                    JSON.stringify(this.extractImportantHeaders(headers)),
                ],
            );

            // Store attachments if any
            if (this.hasAttachment(message.payload!)) {
                await this.storeAttachments(userId, message);
            }
            return true;
        } catch (error) {
            if (error instanceof TokenRefreshFailedError) {
                // Every remaining request will fail the same way — let
                // this propagate out of batchFetchAndStore/the sync loop
                // instead of being counted as a single per-message failure.
                throw error;
            }
            const err = error as { code?: number; message?: string };
            console.error(
                `Failed to fetch message ${messageId}: [${err.code ?? '?'}] ${err.message ?? String(error)}`,
            );
            // Continue with other messages
            return false;
        }
    }

    async computeSenderStats(userId: string): Promise<void> {
        // Replace wholesale rather than upsert, so senders with no
        // remaining messages (e.g. after a bulk delete) don't linger with
        // stale counts.
        await db.query('DELETE FROM sender_stats WHERE user_id = $1', [userId]);

        // Use SQL to compute aggregated sender statistics
        await db.query(
            `
            INSERT INTO sender_stats (
                user_id, sender_email, sender_name, total_emails,
                unread_count, total_size_bytes, first_email_date,
                last_email_date, categories
            )
            SELECT
                user_id,
                sender_email,
                MAX(sender_name) as sender_name,
                COUNT(*) as total_emails,
                SUM(CASE WHEN is_unread THEN 1 ELSE 0 END) as unread_count,
                SUM(size_bytes) as total_size_bytes,
                MIN(date) as first_email_date,
                MAX(date) as last_email_date,
                jsonb_object_agg(category, category_count) as categories
            FROM (
                SELECT
                    user_id, sender_email, sender_name, is_unread, size_bytes, date,
                    category, COUNT(*) as category_count
                FROM email_messages
                WHERE user_id = $1
                GROUP BY user_id, sender_email, sender_name, is_unread, size_bytes, date, category
            ) subquery
            WHERE user_id = $1
            GROUP BY user_id, sender_email
            ON CONFLICT (user_id, sender_email) DO UPDATE SET
                total_emails = EXCLUDED.total_emails,
                unread_count = EXCLUDED.unread_count,
                total_size_bytes = EXCLUDED.total_size_bytes,
                last_email_date = EXCLUDED.last_email_date,
                categories = EXCLUDED.categories,
                updated_at = NOW()
        `,
            [userId],
        );
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    private hasAttachment(payload: gmail_v1.Schema$MessagePart): boolean {
        if (payload.parts) {
            return payload.parts.some(
                (part) => part.filename && part.filename.length > 0,
            );
        }
        return false;
    }

    private extractEmail(emailString: string): string {
        const match = emailString.match(/<(.+?)>/);
        return match ? match[1] : emailString;
    }

    private extractName(emailString: string): string {
        const match = emailString.match(/^(.+?)\s*</);
        return match ? match[1].replace(/"/g, '').trim() : '';
    }

    private extractImportantHeaders(headers: any[]): Record<string, string> {
        const important = [
            'list-unsubscribe',
            'list-id',
            'x-mailer',
            'message-id',
        ];
        const result: Record<string, string> = {};

        headers.forEach((h) => {
            if (important.includes(h.name?.toLowerCase())) {
                result[h.name!] = h.value!;
            }
        });

        return result;
    }

    private async storeAttachments(
        userId: string,
        message: gmail_v1.Schema$Message,
    ): Promise<void> {
        // Implementation for storing attachment metadata
    }

    private async updateMessageLabels(
        userId: string,
        change: any,
    ): Promise<void> {
        // Implementation for updating message labels
    }
}
