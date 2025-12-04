import { gmail_v1, google } from 'googleapis';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth';

export interface EmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    historyId: string;
    internalDate: string;
    subject: string;
    from: string;
    to: string;
    date: Date;
    labels: string[];
    isUnread: boolean;
    hasAttachment: boolean;
    category: 'primary' | 'social' | 'promotions' | 'updates' | 'forums';
    size: number;
}

export interface EmailStats {
    totalEmails: number;
    unreadCount: number;
    categoryCounts: Record<string, number>;
    senderFrequency: Record<string, number>;
    attachmentSize: number;
    oldEmailsCount: number;
}

export interface UnsubscribeInfo {
    messageId: string;
    unsubscribeUrl?: string;
    unsubscribeEmail?: string;
    sender: string;
}

class GmailService {
    private gmail: gmail_v1.Gmail;

    constructor(accessToken: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        this.gmail = google.gmail({ version: 'v1', auth });
    }

    async getProfile() {
        try {
            const response = await this.gmail.users.getProfile({ userId: 'me' });
            return response.data;
        } catch (error) {
            console.error('Error getting profile:', error);
            throw new Error('Failed to get Gmail profile');
        }
    }

    async getMessages(query?: string, maxResults = 50): Promise<EmailMessage[]> {
        try {
            const listResponse = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults,
            });

            if (!listResponse.data.messages) {
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

            return messages.filter(Boolean);
        } catch (error) {
            console.error('Error getting messages:', error);
            throw new Error('Failed to get Gmail messages');
        }
    }

    async getEmailStats(): Promise<EmailStats> {
        try {
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
        } catch (error) {
            console.error('Error archiving messages:', error);
            throw new Error('Failed to archive messages');
        }
    }

    async getUnsubscribeInfo(): Promise<UnsubscribeInfo[]> {
        try {
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
    }): Promise<EmailMessage[]> {
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

    private parseMessage(messageData: gmail_v1.Schema$Message): EmailMessage {
        const headers = messageData.payload?.headers || [];
        const getHeader = (name: string) =>
            headers.find(
                (h: gmail_v1.Schema$MessagePartHeader) =>
                    h.name!.toLowerCase() === name.toLowerCase(),
            )?.value || '';

        // Determine category based on labels
        const labels = messageData.labelIds || [];
        let category: EmailMessage['category'] = 'primary';

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

    return new GmailService(session.accessToken as string);
}

export { GmailService };
