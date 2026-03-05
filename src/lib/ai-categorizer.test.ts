import { describe, expect, it } from 'vitest';
import { AICategorizerService } from './ai-categorizer';
import type { Email } from '@/types/EmailSchema';

let nextId = 0;

function makeEmail(overrides: Partial<Email> = {}): Email {
    nextId += 1;
    return {
        id: `msg-${nextId}`,
        threadId: `thread-${nextId}`,
        snippet: '',
        historyId: '1',
        internalDate: '0',
        subject: '',
        from: 'someone@example.com',
        to: 'me@example.com',
        date: new Date(),
        labels: [],
        isUnread: false,
        hasAttachment: false,
        category: 'primary',
        size: 1024,
        ...overrides,
    };
}

describe('AICategorizerService.categorizeEmail', () => {
    const ai = new AICategorizerService();

    it('recognizes a promotional email by keyword and sender pattern', () => {
        const email = makeEmail({
            from: 'offers@shop.com',
            subject: '50% off - limited time deal',
            snippet: 'Huge sale this weekend',
        });
        const result = ai.categorizeEmail(email);
        expect(result.category).toBe('promotional');
        expect(result.confidence).toBeGreaterThan(0);
    });

    it('recognizes a transactional email', () => {
        const email = makeEmail({
            from: 'orders@store.com',
            subject: 'Your order confirmation #12345',
            snippet: 'Thanks for your order, here is your receipt',
        });
        expect(ai.categorizeEmail(email).category).toBe('transactional');
    });
});

describe('AICategorizerService.generateCleanupSuggestions', () => {
    const ai = new AICategorizerService();

    it('suggests deleting promotional emails older than 6 months', () => {
        const sevenMonthsAgo = new Date();
        sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

        const emails = [
            makeEmail({
                from: 'promo@shop.com',
                subject: 'Big sale - discount inside',
                date: sevenMonthsAgo,
            }),
        ];

        const suggestions = ai.generateCleanupSuggestions(emails);
        const deleteSuggestion = suggestions.find(
            (s) => s.action === 'delete' && s.impact.category === 'promotional',
        );
        expect(deleteSuggestion).toBeDefined();
        expect(deleteSuggestion?.messageIds).toEqual([emails[0].id]);
    });

    it('does not suggest deleting recent promotional emails', () => {
        const emails = [
            makeEmail({
                from: 'promo@shop.com',
                subject: 'Big sale - discount inside',
                date: new Date(),
            }),
        ];

        const suggestions = ai.generateCleanupSuggestions(emails);
        const deleteSuggestion = suggestions.find(
            (s) => s.action === 'delete' && s.impact.category === 'promotional',
        );
        expect(deleteSuggestion).toBeUndefined();
    });

    it('suggests unsubscribing from a newsletter sender with 10+ emails', () => {
        const emails = Array.from({ length: 10 }, () =>
            makeEmail({
                from: 'digest@newsletter.com',
                subject: 'Weekly digest update',
                snippet: 'unsubscribe at the bottom',
            }),
        );

        const suggestions = ai.generateCleanupSuggestions(emails);
        const unsubscribeSuggestion = suggestions.find(
            (s) => s.action === 'unsubscribe',
        );
        expect(unsubscribeSuggestion).toBeDefined();
        expect(unsubscribeSuggestion?.messageIds).toHaveLength(10);
    });

    it('suggests archiving emails with large attachments', () => {
        const emails = [
            makeEmail({ hasAttachment: true, size: 6 * 1024 * 1024 }),
        ];
        const suggestions = ai.generateCleanupSuggestions(emails);
        const suggestion = suggestions.find(
            (s) => s.impact.category === 'attachments',
        );
        expect(suggestion).toBeDefined();
        expect(suggestion?.action).toBe('archive');
        expect(suggestion?.messageIds).toEqual([emails[0].id]);
    });

    it('suggests archiving unread emails older than 6 months, but not important ones', () => {
        const sevenMonthsAgo = new Date();
        sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

        const staleUnread = makeEmail({
            isUnread: true,
            date: sevenMonthsAgo,
            from: 'digest@newsletter.com',
            subject: 'weekly digest',
        });
        const staleUnreadImportant = makeEmail({
            isUnread: true,
            date: sevenMonthsAgo,
            from: 'boss@example.com',
            subject: 'urgent: deadline tomorrow',
        });

        const suggestions = ai.generateCleanupSuggestions([
            staleUnread,
            staleUnreadImportant,
        ]);
        const suggestion = suggestions.find(
            (s) => s.impact.category === 'unread',
        );
        expect(suggestion).toBeDefined();
        expect(suggestion?.action).toBe('archive');
        expect(suggestion?.messageIds).toEqual([staleUnread.id]);
    });

    it('suggests archiving transactional receipts older than a year', () => {
        const thirteenMonthsAgo = new Date();
        thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

        const emails = [
            makeEmail({
                from: 'orders@store.com',
                subject: 'Order confirmation #123',
                snippet: 'Thanks for your order, here is your receipt',
                date: thirteenMonthsAgo,
            }),
        ];
        const suggestions = ai.generateCleanupSuggestions(emails);
        const suggestion = suggestions.find(
            (s) => s.impact.category === 'transactional',
        );
        expect(suggestion).toBeDefined();
        expect(suggestion?.action).toBe('archive');
        expect(suggestion?.messageIds).toEqual([emails[0].id]);
    });
});

describe('AICategorizerService.getSmartFilters', () => {
    const ai = new AICategorizerService();

    it('returns serializable filters with matched message ids, no functions', () => {
        const bigAttachment = makeEmail({
            hasAttachment: true,
            size: 6 * 1024 * 1024,
        });
        const smallAttachment = makeEmail({
            hasAttachment: true,
            size: 1024,
        });

        const filters = ai.getSmartFilters([bigAttachment, smallAttachment]);
        const json: unknown = JSON.parse(JSON.stringify(filters));
        expect(json).toEqual(filters);

        const largeAttachmentsFilter = filters.find(
            (f) => f.name === 'Large Attachments',
        );
        expect(largeAttachmentsFilter?.messageIds).toEqual([bigAttachment.id]);
    });
});
