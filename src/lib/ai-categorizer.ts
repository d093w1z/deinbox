// lib/ai-categorizer.ts
import type { Email } from '@/types/EmailSchema';

export interface EmailCategory {
    category:
        | 'important'
        | 'newsletter'
        | 'spam'
        | 'transactional'
        | 'social'
        | 'promotional'
        | 'personal';
    confidence: number;
    reasons: string[];
}

export interface CleanupSuggestion {
    action: 'delete' | 'archive' | 'unsubscribe' | 'keep';
    messageIds: string[];
    reason: string;
    confidence: number;
    impact: { emailsAffected: number; spaceFreed: number; category: string };
    sender?: string;
}

class AICategorizerService {
    // Keywords and patterns for different categories
    private readonly patterns = {
        newsletter: {
            keywords: [
                'newsletter',
                'unsubscribe',
                'digest',
                'weekly',
                'monthly',
                'update',
                'news',
            ],
            senderPatterns: ['noreply@', 'newsletter@', 'news@', 'digest@'],
            subjectPatterns: ['newsletter', 'weekly digest', 'monthly update'],
        },
        promotional: {
            keywords: [
                'sale',
                'discount',
                'offer',
                'deal',
                'promotion',
                'coupon',
                'free',
                'limited time',
            ],
            senderPatterns: ['marketing@', 'promo@', 'offers@'],
            subjectPatterns: ['\\d+% off', 'sale', 'deal', 'free'],
        },
        transactional: {
            keywords: [
                'receipt',
                'order',
                'confirmation',
                'invoice',
                'payment',
                'shipping',
                'tracking',
            ],
            senderPatterns: ['orders@', 'billing@', 'payments@', 'support@'],
            subjectPatterns: ['order #', 'receipt', 'confirmation', 'invoice'],
        },
        social: {
            keywords: [
                'friend',
                'follow',
                'like',
                'comment',
                'mention',
                'tagged',
            ],
            senderPatterns: [
                'facebook',
                'twitter',
                'linkedin',
                'instagram',
                'notifications@',
            ],
            subjectPatterns: ['mentioned you', 'tagged you', 'friend request'],
        },
        spam: {
            keywords: [
                'viagra',
                'lottery',
                'winner',
                'congratulations',
                'urgent',
                'act now',
                'guarantee',
            ],
            senderPatterns: ['suspicious patterns'],
            subjectPatterns: ['re:', 'fw:', 'urgent', 'congratulations'],
        },
        important: {
            keywords: [
                'urgent',
                'important',
                'asap',
                'deadline',
                'meeting',
                'appointment',
            ],
            senderPatterns: ['boss@', 'manager@', 'admin@'],
            subjectPatterns: ['urgent', 'meeting', 'deadline'],
        },
    };

    categorizeEmail(email: Email): EmailCategory {
        const scores = this.calculateCategoryScores(email);
        const topCategory = Object.entries(scores).reduce((a, b) =>
            scores[a[0]] > scores[b[0]] ? a : b,
        );

        return {
            category: topCategory[0] as EmailCategory['category'],
            confidence: topCategory[1],
            reasons: this.getReasons(email, topCategory[0]),
        };
    }

    private calculateCategoryScores(email: Email): Record<string, number> {
        const scores: Record<string, number> = {};
        const text =
            `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();

        Object.entries(this.patterns).forEach(([category, patterns]) => {
            let score = 0;

            // Keyword matching
            patterns.keywords.forEach((keyword) => {
                if (text.includes(keyword)) {
                    score += 1;
                }
            });

            // Sender pattern matching
            patterns.senderPatterns.forEach((pattern) => {
                if (email.from.toLowerCase().includes(pattern)) {
                    score += 2;
                }
            });

            // Subject pattern matching
            patterns.subjectPatterns.forEach((pattern) => {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(email.subject)) {
                    score += 1.5;
                }
            });

            scores[category] = score;
        });

        // Normalize scores to 0-1 range
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore > 0) {
            Object.keys(scores).forEach((key) => {
                scores[key] = scores[key] / maxScore;
            });
        }

        return scores;
    }

    private getReasons(email: Email, category: string): string[] {
        const reasons: string[] = [];
        const text =
            `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
        const patterns = this.patterns[category as keyof typeof this.patterns];

        if (patterns) {
            patterns.keywords.forEach((keyword) => {
                if (text.includes(keyword)) {
                    reasons.push(`Contains keyword: ${keyword}`);
                }
            });

            patterns.senderPatterns.forEach((pattern) => {
                if (email.from.toLowerCase().includes(pattern)) {
                    reasons.push(`Sender pattern: ${pattern}`);
                }
            });
        }

        return reasons;
    }

    generateCleanupSuggestions(emails: Email[]): CleanupSuggestion[] {
        const suggestions: CleanupSuggestion[] = [];
        const categorizedEmails = emails.map((email) => ({
            email,
            category: this.categorizeEmail(email),
        }));

        // Suggestion 1: Delete old promotional emails
        const oldPromotional = categorizedEmails.filter(
            ({ email, category }) => {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                return (
                    category.category === 'promotional' &&
                    email.date < sixMonthsAgo
                );
            },
        );

        if (oldPromotional.length > 0) {
            suggestions.push({
                action: 'delete',
                messageIds: oldPromotional.map(({ email }) => email.id),
                reason: 'Old promotional emails (6+ months old)',
                confidence: 0.9,
                impact: {
                    emailsAffected: oldPromotional.length,
                    spaceFreed: oldPromotional.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'promotional',
                },
            });
        }

        // Suggestion 2: Unsubscribe from frequent newsletters
        const newsletterSenders = this.getFrequentSenders(
            categorizedEmails.filter(
                ({ category }) => category.category === 'newsletter',
            ),
            10,
        );

        newsletterSenders.forEach(({ sender, emails }) => {
            suggestions.push({
                action: 'unsubscribe',
                messageIds: emails.map((email) => email.id),
                reason: `Frequent newsletter sender: ${sender}`,
                confidence: 0.8,
                impact: {
                    emailsAffected: emails.length,
                    spaceFreed: emails.reduce(
                        (sum, email) => sum + email.size,
                        0,
                    ),
                    category: 'newsletter',
                },
                sender,
            });
        });

        // Suggestion 3: Archive old social notifications
        const oldSocial = categorizedEmails.filter(({ email, category }) => {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return (
                category.category === 'social' && email.date < threeMonthsAgo
            );
        });

        if (oldSocial.length > 0) {
            suggestions.push({
                action: 'archive',
                messageIds: oldSocial.map(({ email }) => email.id),
                reason: 'Old social media notifications (3+ months old)',
                confidence: 0.85,
                impact: {
                    emailsAffected: oldSocial.length,
                    spaceFreed: oldSocial.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'social',
                },
            });
        }

        // Suggestion 4: Delete suspected spam
        const suspectedSpam = categorizedEmails.filter(
            ({ category }) =>
                category.category === 'spam' && category.confidence > 0.7,
        );

        if (suspectedSpam.length > 0) {
            suggestions.push({
                action: 'delete',
                messageIds: suspectedSpam.map(({ email }) => email.id),
                reason: 'Suspected spam emails',
                confidence: 0.75,
                impact: {
                    emailsAffected: suspectedSpam.length,
                    spaceFreed: suspectedSpam.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'spam',
                },
            });
        }

        // Suggestion 5: Archive emails with large attachments
        const largeAttachments = categorizedEmails.filter(
            ({ email }) => email.hasAttachment && email.size > 5 * 1024 * 1024,
        );

        if (largeAttachments.length > 0) {
            suggestions.push({
                action: 'archive',
                messageIds: largeAttachments.map(({ email }) => email.id),
                reason: 'Emails with large attachments (5MB+)',
                confidence: 0.7,
                impact: {
                    emailsAffected: largeAttachments.length,
                    spaceFreed: largeAttachments.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'attachments',
                },
            });
        }

        // Suggestion 6: Archive old unread emails (never opened, unlikely
        // to be missed, but not deleted in case they still matter)
        const oldUnread = categorizedEmails.filter(({ email, category }) => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return (
                email.isUnread &&
                email.date < sixMonthsAgo &&
                category.category !== 'important'
            );
        });

        if (oldUnread.length > 0) {
            suggestions.push({
                action: 'archive',
                messageIds: oldUnread.map(({ email }) => email.id),
                reason: 'Unread emails older than 6 months',
                confidence: 0.6,
                impact: {
                    emailsAffected: oldUnread.length,
                    spaceFreed: oldUnread.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'unread',
                },
            });
        }

        // Suggestion 7: Archive stale transactional receipts (kept, just
        // out of the way — refunds/warranty windows for year-old receipts
        // have almost always passed)
        const staleTransactional = categorizedEmails.filter(
            ({ email, category }) => {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                return (
                    category.category === 'transactional' &&
                    email.date < oneYearAgo
                );
            },
        );

        if (staleTransactional.length > 0) {
            suggestions.push({
                action: 'archive',
                messageIds: staleTransactional.map(({ email }) => email.id),
                reason: 'Receipts and confirmations older than a year',
                confidence: 0.65,
                impact: {
                    emailsAffected: staleTransactional.length,
                    spaceFreed: staleTransactional.reduce(
                        (sum, { email }) => sum + email.size,
                        0,
                    ),
                    category: 'transactional',
                },
            });
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    private getFrequentSenders(
        categorizedEmails: { email: Email; category: EmailCategory }[],
        minCount: number,
    ): { sender: string; emails: Email[] }[] {
        const senderCounts: Record<string, Email[]> = {};

        categorizedEmails.forEach(({ email }) => {
            const sender = this.extractEmail(email.from);
            if (!senderCounts[sender]) {
                senderCounts[sender] = [];
            }
            senderCounts[sender].push(email);
        });

        return Object.entries(senderCounts)
            .filter(([, emails]) => emails.length >= minCount)
            .map(([sender, emails]) => ({ sender, emails }))
            .sort((a, b) => b.emails.length - a.emails.length);
    }

    private extractEmail(emailString: string): string {
        const match = emailString.match(/<(.+)>/);
        return match ? match[1] : emailString;
    }

    // Analyze email interaction patterns
    analyzeInteractionPatterns(emails: Email[]): {
        lowEngagement: Email[];
        neverOpened: Email[];
        frequentSenders: {
            sender: string;
            count: number;
            lastInteraction?: Date | string;
        }[];
        inactiveThreads: Email[];
    } {
        const neverOpened = emails.filter((email) => email.isUnread);
        const lowEngagement = emails.filter((email) => {
            const category = this.categorizeEmail(email);
            return (
                category.category === 'newsletter' ||
                category.category === 'promotional'
            );
        });

        const senderStats: Record<
            string,
            {
                count: number;
                lastInteraction?: Date | string;
            }
        > = {};
        emails.forEach((email) => {
            const sender = this.extractEmail(email.from);
            if (!senderStats[sender]) {
                senderStats[sender] = { count: 0 };
            }
            senderStats[sender].count++;
            // Simulate last interaction (in real app, track actual
            // interactions)
            if (!email.isUnread) {
                senderStats[sender].lastInteraction = email.date;
            }
        });

        const frequentSenders = Object.entries(senderStats)
            .map(([sender, stats]) => ({ sender, ...stats }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Find threads with no recent activity
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const inactiveThreads = emails.filter(
            (email) => email.date < oneMonthAgo && email.isUnread,
        );

        return {
            lowEngagement,
            neverOpened,
            frequentSenders,
            inactiveThreads,
        };
    }

    // Smart filtering based on multiple criteria. Returns the matched
    // message ids directly (rather than a filter function) so the result
    // is JSON-serializable and usable as-is by API clients.
    getSmartFilters(emails: Email[]): {
        name: string;
        description: string;
        estimatedImpact: string;
        messageIds: string[];
    }[] {
        const filters: {
            name: string;
            description: string;
            estimatedImpact: string;
            predicate: (email: Email) => boolean;
        }[] = [
            {
                name: 'Old Newsletters',
                description: 'Newsletter emails older than 3 months',
                predicate: (email) => {
                    const threeMonthsAgo = new Date();
                    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                    const category = this.categorizeEmail(email);
                    return (
                        category.category === 'newsletter' &&
                        email.date < threeMonthsAgo
                    );
                },
                estimatedImpact:
                    'High - Removes clutter, keeps recent newsletters',
            },
            {
                name: 'Promotional Emails',
                description: 'All promotional and marketing emails',
                predicate: (email) =>
                    this.categorizeEmail(email).category === 'promotional',
                estimatedImpact:
                    'Medium - Removes marketing emails, may include wanted offers',
            },
            {
                name: 'Large Attachments',
                description: 'Emails with attachments larger than 5MB',
                predicate: (email) =>
                    email.hasAttachment && email.size > 5 * 1024 * 1024,
                estimatedImpact: 'High - Frees up significant storage space',
            },
            {
                name: 'Old Social Notifications',
                description: 'Social media notifications older than 1 month',
                predicate: (email) => {
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                    const category = this.categorizeEmail(email);
                    return (
                        category.category === 'social' &&
                        email.date < oneMonthAgo
                    );
                },
                estimatedImpact:
                    'Medium - Removes outdated social notifications',
            },
            {
                name: 'Unread Old Emails',
                description: 'Unread emails older than 6 months',
                predicate: (email) => {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    return email.isUnread && email.date < sixMonthsAgo;
                },
                estimatedImpact:
                    'Medium - Likely irrelevant, but may contain important items',
            },
        ];

        return filters.map(({ predicate, ...rest }) => ({
            ...rest,
            messageIds: emails.filter(predicate).map((email) => email.id),
        }));
    }
}

export { AICategorizerService };
