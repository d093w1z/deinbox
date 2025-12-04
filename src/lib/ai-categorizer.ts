// lib/ai-categorizer.ts
import { EmailMessage } from './gmail';

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
            keywords: ['friend', 'follow', 'like', 'comment', 'mention', 'tagged'],
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

    categorizeEmail(email: EmailMessage): EmailCategory {
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

    private calculateCategoryScores(email: EmailMessage): Record<string, number> {
        const scores: Record<string, number> = {};
        const text = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();

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

    private getReasons(email: EmailMessage, category: string): string[] {
        const reasons: string[] = [];
        const text = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
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

    generateCleanupSuggestions(emails: EmailMessage[]): CleanupSuggestion[] {
        const suggestions: CleanupSuggestion[] = [];
        const categorizedEmails = emails.map((email) => ({
            email,
            category: this.categorizeEmail(email),
        }));

        // Suggestion 1: Delete old promotional emails
        const oldPromotional = categorizedEmails.filter(({ email, category }) => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return category.category === 'promotional' && email.date < sixMonthsAgo;
        });

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
                    spaceFreed: emails.reduce((sum, email) => sum + email.size, 0),
                    category: 'newsletter',
                },
            });
        });

        // Suggestion 3: Archive old social notifications
        const oldSocial = categorizedEmails.filter(({ email, category }) => {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return category.category === 'social' && email.date < threeMonthsAgo;
        });

        if (oldSocial.length > 0) {
            suggestions.push({
                action: 'archive',
                messageIds: oldSocial.map(({ email }) => email.id),
                reason: 'Old social media notifications (3+ months old)',
                confidence: 0.85,
                impact: {
                    emailsAffected: oldSocial.length,
                    spaceFreed: oldSocial.reduce((sum, { email }) => sum + email.size, 0),
                    category: 'social',
                },
            });
        }

        // Suggestion 4: Delete suspected spam
        const suspectedSpam = categorizedEmails.filter(
            ({ category }) => category.category === 'spam' && category.confidence > 0.7,
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

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    private getFrequentSenders(
        categorizedEmails: { email: EmailMessage; category: EmailCategory }[],
        minCount: number,
    ): { sender: string; emails: EmailMessage[] }[] {
        const senderCounts: Record<string, EmailMessage[]> = {};

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
    analyzeInteractionPatterns(emails: EmailMessage[]): {
        lowEngagement: EmailMessage[];
        neverOpened: EmailMessage[];
        frequentSenders: { sender: string; count: number; lastInteraction?: Date }[];
        inactiveThreads: EmailMessage[];
    } {
        const neverOpened = emails.filter((email) => email.isUnread);
        const lowEngagement = emails.filter((email) => {
            const category = this.categorizeEmail(email);
            return (
                category.category === 'newsletter' || category.category === 'promotional'
            );
        });

        const senderStats: Record<
            string,
            {
                count: number;
                lastInteraction?: Date;
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

    // Smart filtering based on multiple criteria
    getSmartFilters(): {
        name: string;
        description: string;
        query: (emails: EmailMessage[]) => EmailMessage[];
        estimatedImpact: string;
    }[] {
        return [
            {
                name: 'Old Newsletters',
                description: 'Newsletter emails older than 3 months',
                query: (emails) =>
                    emails.filter((email) => {
                        const threeMonthsAgo = new Date();
                        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                        const category = this.categorizeEmail(email);
                        return (
                            category.category === 'newsletter' &&
                            email.date < threeMonthsAgo
                        );
                    }),
                estimatedImpact: 'High - Removes clutter, keeps recent newsletters',
            },
            {
                name: 'Promotional Emails',
                description: 'All promotional and marketing emails',
                query: (emails) =>
                    emails.filter((email) => {
                        const category = this.categorizeEmail(email);
                        return category.category === 'promotional';
                    }),
                estimatedImpact:
                    'Medium - Removes marketing emails, may include wanted offers',
            },
            {
                name: 'Large Attachments',
                description: 'Emails with attachments larger than 5MB',
                query: (emails) =>
                    emails.filter(
                        (email) => email.hasAttachment && email.size > 5 * 1024 * 1024,
                    ),
                estimatedImpact: 'High - Frees up significant storage space',
            },
            {
                name: 'Old Social Notifications',
                description: 'Social media notifications older than 1 month',
                query: (emails) =>
                    emails.filter((email) => {
                        const oneMonthAgo = new Date();
                        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                        const category = this.categorizeEmail(email);
                        return category.category === 'social' && email.date < oneMonthAgo;
                    }),
                estimatedImpact: 'Medium - Removes outdated social notifications',
            },
            {
                name: 'Unread Old Emails',
                description: 'Unread emails older than 6 months',
                query: (emails) =>
                    emails.filter((email) => {
                        const sixMonthsAgo = new Date();
                        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                        return email.isUnread && email.date < sixMonthsAgo;
                    }),
                estimatedImpact:
                    'Medium - Likely irrelevant, but may contain important items',
            },
        ];
    }
}

export { AICategorizerService };
