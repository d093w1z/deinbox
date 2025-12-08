import { gmail_v1, google } from 'googleapis';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth';
import { getCacheService } from './redis';
import { Email } from '@/types/EmailSchema';
import { EmailStats } from '@/types/EmailStats';
import { UnsubscribeInfo } from '@/types/UnsubscribeInfo';
class GmailService {
    private gmail: gmail_v1.Gmail;
    private cache = getCacheService();
    private userId: string;

    constructor(accessToken: string, userId: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        this.gmail = google.gmail({ version: 'v1', auth });
        this.userId = userId;
    }

    private getCacheKey(prefix: string, ...parts: string[]): string {
        return `gmail:${this.userId}:${prefix}:${parts.join(':')}`;
    }

    async getProfile() {
        const cacheKey = this.getCacheKey('profile');

        try {
            // Try to get from cache
            const cached = await this.cache.get<gmail_v1.Schema$Profile>(cacheKey);
            if (cached) {
                return cached;
            }

            // Fetch from API
            const response = await this.gmail.users.getProfile({ userId: 'me' });

            // Cache for 1 hour
            await this.cache.set(cacheKey, response.data, 3600);

            return response.data;
        } catch (error) {
            console.error('Error getting profile:', error);
            throw new Error('Failed to get Gmail profile');
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
                listResponse.data.messages.map(async (msg: gmail_v1.Schema$Message) => {
                    const messageResponse = await this.gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                        format: 'full',
                    });

                    return this.parseMessage(messageResponse.data);
                }),
            );

            const filteredMessages = messages.filter(Boolean);

            // Cache for 5 minutes (messages can change frequently)
            await this.cache.set(cacheKey, filteredMessages, 300);

            return filteredMessages;
        } catch (error) {
            console.error('Error getting messages:', error);
            throw new Error('Failed to get Gmail messages');
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
                stats.senderFrequency[sender] = (stats.senderFrequency[sender] || 0) + 1;

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
            throw new Error('Failed to get email statistics');
        }
    }

    async deleteMessages(messageIds: string[]): Promise<void> {
        try {
            await Promise.all(
                messageIds.map((id) =>
                    this.gmail.users.messages.delete({ userId: 'me', id }),
                ),
            );

            // Invalidate relevant caches after deletion
            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error deleting messages:', error);
            throw new Error('Failed to delete messages');
        }
    }

    async archiveMessages(messageIds: string[]): Promise<void> {
        try {
            await this.gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: { ids: messageIds, removeLabelIds: ['INBOX'] },
            });

            // Invalidate relevant caches after archiving
            await this.invalidateMessageCaches();
        } catch (error) {
            console.error('Error archiving messages:', error);
            throw new Error('Failed to archive messages');
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

            // Fetch promotional emails
            const promotionalEmails = await this.getMessages('category:promotions');
            const unsubscribeInfo: UnsubscribeInfo[] = [];

            for (const message of promotionalEmails) {
                const fullMessage = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full',
                });

                const headers = fullMessage.data.payload?.headers || [];
                const unsubscribeHeader = headers.find(
                    (h: gmail_v1.Schema$MessagePartHeader) =>
                        h.name!.toLowerCase() === 'list-unsubscribe',
                );

                if (unsubscribeHeader) {
                    const unsubscribeValue = unsubscribeHeader.value;
                    const urlMatch = unsubscribeValue!.match(/<(https?:\/\/[^>]+)>/);
                    const emailMatch = unsubscribeValue!.match(/<mailto:([^>]+)>/);

                    unsubscribeInfo.push({
                        messageId: message.id,
                        unsubscribeUrl: urlMatch?.[1],
                        unsubscribeEmail: emailMatch?.[1],
                        sender: this.extractEmail(message.from),
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

    /**
     * Invalidate all message-related caches when messages are modified
     */
    private async invalidateMessageCaches(): Promise<void> {
        // Note: This is a simple implementation. In production, you might want to use
        // Redis patterns to delete multiple keys at once, or use a more sophisticated
        // cache invalidation strategy.

        // For now, we can't easily delete all cache keys without scanning,
        // so we'll rely on TTL expiration. Alternatively, you could maintain
        // a set of cache keys and delete them explicitly.

        console.log('Cache invalidation triggered for user:', this.userId);
        // If you need immediate invalidation, implement key tracking or use Redis SCAN
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
        else if (labels.includes('CATEGORY_PROMOTIONS')) category = 'promotions';
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

    return new GmailService(session.accessToken as string, userId);
}

export { GmailService };
