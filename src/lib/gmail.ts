import type { gmail_v1 } from 'googleapis';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth';
import { getCacheService } from './redis';
import type { Email } from '@/types/EmailSchema';
import type { EmailStats } from '@/types/EmailStats';
import type { UnsubscribeInfo } from '@/types/UnsubscribeInfo';
import { mapGmailError } from './gmail-error';

// Gmail's batchModify caps a single call at 1000 message ids.
const BATCH_LIMIT = 1000;

function chunkForBatch<T>(items: T[]): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
        chunks.push(items.slice(i, i + BATCH_LIMIT));
    }
    return chunks;
}

class GmailService {
    private gmail: gmail_v1.Gmail;
    private auth: InstanceType<typeof google.auth.OAuth2>;
    private cache = getCacheService();
    private userId: string;

    constructor(accessToken: string, userId: string) {
        this.auth = new google.auth.OAuth2();
        this.auth.setCredentials({ access_token: accessToken });
        this.gmail = google.gmail({ version: 'v1', auth: this.auth });
        this.userId = userId;
    }

    get client(): gmail_v1.Gmail {
        return this.gmail;
    }

    // Swaps in a freshly-refreshed access token. Callers keep using the
    // same GmailService/client instance — its underlying OAuth2Client is
    // mutated in place, so every subsequent request (including ones
    // already in flight when this is called) picks up the new token.
    updateAccessToken(accessToken: string): void {
        this.auth.setCredentials({ access_token: accessToken });
    }

    private getCacheKey(prefix: string, ...parts: string[]): string {
        return `gmail:${this.userId}:${prefix}:${parts.join(':')}`;
    }

    async getProfile(): Promise<gmail_v1.Schema$Profile> {
        const cacheKey = this.getCacheKey('profile');

        try {
            const cached = await this.cache.get(cacheKey);
            if (cached) return cached;

            const response = await this.gmail.users.getProfile({
                userId: 'me',
            });
            await this.cache.set(cacheKey, response.data, 3600);

            return response.data;
        } catch (error) {
            console.error('Gmail profile error:', error);
            mapGmailError(error);
        }
    }
    async getMessages(query?: string, maxResults = 50): Promise<Email[]> {
        const cacheKey = this.getCacheKey(
            'messages',
            query || 'all',
            maxResults.toString(),
        );

        try {
            // Try to get from cache
            const cached = await this.cache.get<Email[]>(cacheKey);
            if (cached) {
                // Rehydrate date objects
                return cached.map((msg) => ({
                    ...msg,
                    date: new Date(msg.date),
                }));
            }

            // Fetch from API
            const listResponse = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults,
            });

            if (!listResponse.data.messages) {
                await this.cache.set(cacheKey, [], 300); // Cache empty results for 5 minutes
                return [];
            }

            const messages = await Promise.all(
                listResponse.data.messages.map(
                    async (msg: gmail_v1.Schema$Message) => {
                        const messageResponse =
                            await this.gmail.users.messages.get({
                                userId: 'me',
                                id: msg.id!,
                                format: 'full',
                            });

                        return this.parseMessage(messageResponse.data);
                    },
                ),
            );

            const filteredMessages = messages.filter(Boolean);

            // Cache for 5 minutes (messages can change frequently)
            await this.cache.set(cacheKey, filteredMessages, 300);

            return filteredMessages;
        } catch (error: unknown) {
            console.error('Error getting messages:', error);
            mapGmailError(error);
        }
    }

    async getEmailStats(): Promise<EmailStats> {
        const cacheKey = this.getCacheKey('stats');

        try {
            // Try to get from cache
            const cached = await this.cache.get<EmailStats>(cacheKey);
            if (cached) {
                return cached;
            }

            // Fetch and compute stats
            const allMessages = await this.getMessages('', 1000);
            const unreadMessages = await this.getMessages('is:unread');

            const stats: EmailStats = {
                totalEmails: allMessages.length,
                unreadCount: unreadMessages.length,
                categoryCounts: {},
                senderFrequency: {},
                attachmentSize: 0,
                oldEmailsCount: 0,
            };

            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            allMessages.forEach((message) => {
                // Category counts
                stats.categoryCounts[message.category] =
                    (stats.categoryCounts[message.category] || 0) + 1;

                // Sender frequency
                const sender = this.extractEmail(message.from);
                stats.senderFrequency[sender] =
                    (stats.senderFrequency[sender] || 0) + 1;

                // Attachment size
                stats.attachmentSize += message.size;

                // Old emails
                if (message.date < oneYearAgo) {
                    stats.oldEmailsCount++;
                }
            });

            // Cache for 15 minutes
            await this.cache.set(cacheKey, stats, 900);

            return stats;
        } catch (error) {
            console.error('Error getting email stats:', error);
            mapGmailError(error);
        }
    }

    // Our OAuth scope is gmail.modify, not the full-account
    // https://mail.google.com/ scope, so we can't call messages.delete
    // (permanent delete) — batchModify into TRASH is the closest
    // equivalent, and it has the added benefit of being undoable via
    // undeleteMessages. batchModify caps out at 1000 ids per call, so
    // larger selections are chunked.
    async deleteMessages(messageIds: string[]): Promise<void> {
        try {
            for (const chunk of chunkForBatch(messageIds)) {
                await this.gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: chunk,
                        addLabelIds: ['TRASH'],
                        removeLabelIds: ['INBOX'],
                    },
                });
            }

            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error deleting messages:', error);

            mapGmailError(error);
        }
    }

    async undeleteMessages(messageIds: string[]): Promise<void> {
        try {
            for (const chunk of chunkForBatch(messageIds)) {
                await this.gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: chunk,
                        addLabelIds: ['INBOX'],
                        removeLabelIds: ['TRASH'],
                    },
                });
            }

            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error restoring messages:', error);
            throw new Error('Failed to restore messages');
        }
    }

    async archiveMessages(messageIds: string[]): Promise<void> {
        try {
            for (const chunk of chunkForBatch(messageIds)) {
                await this.gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: { ids: chunk, removeLabelIds: ['INBOX'] },
                });
            }

            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error archiving messages:', error);
            throw new Error('Failed to archive messages');
        }
    }

    async unarchiveMessages(messageIds: string[]): Promise<void> {
        try {
            for (const chunk of chunkForBatch(messageIds)) {
                await this.gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: { ids: chunk, addLabelIds: ['INBOX'] },
                });
            }

            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error unarchiving messages:', error);
            throw new Error('Failed to unarchive messages');
        }
    }

    async getUnsubscribeInfo(): Promise<UnsubscribeInfo[]> {
        const cacheKey = this.getCacheKey('unsubscribe');

        try {
            // Try to get from cache
            const cached = await this.cache.get<UnsubscribeInfo[]>(cacheKey);
            if (cached) {
                return cached;
            }

            // Fetch promotional message ids, then pull each full message
            // exactly once in parallel — getMessages() already does a
            // full fetch per message internally to build its Email[]
            // return value, but doesn't keep the raw headers we need
            // here (List-Unsubscribe), so re-fetching sequentially
            // through it as a second pass was doing 2N Gmail API calls
            // for N candidate messages. A single list + parallel get
            // pass does N+1.
            const listResponse = await this.gmail.users.messages.list({
                userId: 'me',
                q: 'category:promotions',
            });
            const messageIds = listResponse.data.messages ?? [];

            const fullMessages = await Promise.all(
                messageIds.map((m) =>
                    this.gmail.users.messages.get({
                        userId: 'me',
                        id: m.id!,
                        format: 'full',
                    }),
                ),
            );

            const unsubscribeInfo: UnsubscribeInfo[] = [];

            for (const fullMessage of fullMessages) {
                const headers = fullMessage.data.payload?.headers || [];
                const unsubscribeHeader = headers.find(
                    (h: gmail_v1.Schema$MessagePartHeader) =>
                        h.name!.toLowerCase() === 'list-unsubscribe',
                );

                if (unsubscribeHeader) {
                    const unsubscribeValue = unsubscribeHeader.value;
                    const urlMatch =
                        unsubscribeValue!.match(/<(https?:\/\/[^>]+)>/);
                    const emailMatch =
                        unsubscribeValue!.match(/<mailto:([^>]+)>/);
                    const fromHeader = headers.find(
                        (h: gmail_v1.Schema$MessagePartHeader) =>
                            h.name!.toLowerCase() === 'from',
                    );

                    unsubscribeInfo.push({
                        messageId: fullMessage.data.id!,
                        unsubscribeUrl: urlMatch?.[1],
                        unsubscribeEmail: emailMatch?.[1],
                        sender: this.extractEmail(fromHeader?.value ?? ''),
                    });
                }
            }

            // Cache for 1 hour
            await this.cache.set(cacheKey, unsubscribeInfo, 3600);

            return unsubscribeInfo;
        } catch (error) {
            console.error('Error getting unsubscribe info:', error);
            throw new Error('Failed to get unsubscribe information');
        }
    }

    async getMessagesByFilter(filter: {
        olderThan?: Date;
        sender?: string;
        hasAttachment?: boolean;
        category?: string;
        isUnread?: boolean;
    }): Promise<Email[]> {
        let query = '';

        if (filter.olderThan) {
            const dateStr = filter.olderThan.toISOString().split('T')[0];
            query += `before:${dateStr} `;
        }

        if (filter.sender) {
            query += `from:${filter.sender} `;
        }

        if (filter.hasAttachment) {
            query += 'has:attachment ';
        }

        if (filter.category) {
            query += `category:${filter.category} `;
        }

        if (filter.isUnread) {
            query += 'is:unread ';
        }

        return this.getMessages(query.trim());
    }

    private async invalidateMessageCaches(): Promise<void> {
        await this.cache.invalidateUserCache(this.userId);
    }

    private parseMessage(messageData: gmail_v1.Schema$Message): Email {
        const headers = messageData.payload?.headers || [];
        const getHeader = (name: string) =>
            headers.find(
                (h: gmail_v1.Schema$MessagePartHeader) =>
                    h.name!.toLowerCase() === name.toLowerCase(),
            )?.value || '';

        // Determine category based on labels
        const labels = messageData.labelIds || [];
        let category: Email['category'] = 'primary';

        if (labels.includes('CATEGORY_SOCIAL')) category = 'social';
        else if (labels.includes('CATEGORY_PROMOTIONS'))
            category = 'promotions';
        else if (labels.includes('CATEGORY_UPDATES')) category = 'updates';
        else if (labels.includes('CATEGORY_FORUMS')) category = 'forums';

        return {
            id: messageData.id!,
            threadId: messageData.threadId!,
            snippet: messageData.snippet || '',
            historyId: messageData.historyId!,
            internalDate: messageData.internalDate!,
            subject: getHeader('subject'),
            from: getHeader('from'),
            to: getHeader('to'),
            date: new Date(parseInt(messageData.internalDate!)),
            labels,
            isUnread: labels.includes('UNREAD'),
            hasAttachment: this.hasAttachment(messageData.payload!),
            category,
            size: messageData.sizeEstimate || 0,
        };
    }

    private hasAttachment(payload: gmail_v1.Schema$MessagePart): boolean {
        if (payload.parts) {
            return payload.parts.some(
                (part: gmail_v1.Schema$MessagePart) =>
                    part.filename && part.filename.length > 0,
            );
        }
        return false;
    }

    private extractEmail(emailString: string): string {
        const match = emailString.match(/<(.+)>/);
        return match ? match[1] : emailString;
    }
}

export async function getGmailService() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        throw new Error('No access token available');
    }

    // Use user email or ID as cache key identifier
    const userId = session.user?.email || session.user?.id || 'default';

    return new GmailService(session.accessToken, userId);
}

export { GmailService };
