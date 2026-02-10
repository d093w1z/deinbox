import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './search-query';

describe('parseSearchQuery', () => {
    it('parses from: and leaves free text intact', () => {
        const result = parseSearchQuery('from:google invoice');
        expect(result.from).toBe('google');
        expect(result.freeText).toBe('invoice');
    });

    it('parses has:attachment', () => {
        expect(parseSearchQuery('has:attachment').hasAttachment).toBe(true);
    });

    it('parses is:unread, is:read, is:starred', () => {
        expect(parseSearchQuery('is:unread').isUnread).toBe(true);
        expect(parseSearchQuery('is:read').isRead).toBe(true);
        expect(parseSearchQuery('is:starred').isStarred).toBe(true);
    });

    it('parses before: and after: dates', () => {
        const result = parseSearchQuery('after:2024-01-01 before:2024/06/30');
        expect(result.after).toBe('2024-01-01');
        expect(result.before).toBe('2024-06-30');
    });

    it('parses older_than: and newer_than: relative windows', () => {
        expect(parseSearchQuery('older_than:6m').olderThanDays).toBe(180);
        expect(parseSearchQuery('newer_than:7d').newerThanDays).toBe(7);
        expect(parseSearchQuery('older_than:1y').olderThanDays).toBe(365);
    });

    it('parses subject:, category:, label:', () => {
        const result = parseSearchQuery(
            'subject:receipt category:promotions label:INBOX',
        );
        expect(result.subject).toBe('receipt');
        expect(result.category).toBe('promotions');
        expect(result.label).toBe('INBOX');
    });

    it('treats unrecognized operators as free text', () => {
        const result = parseSearchQuery('has:invalidvalue foo:bar hello');
        expect(result.hasAttachment).toBeUndefined();
        expect(result.freeText).toBe('has:invalidvalue foo:bar hello');
    });

    it('treats an invalid date as free text', () => {
        const result = parseSearchQuery('before:not-a-date');
        expect(result.before).toBeUndefined();
        expect(result.freeText).toBe('before:not-a-date');
    });

    it('combines multiple operators with leftover free text', () => {
        const result = parseSearchQuery(
            'from:newsletter is:unread urgent meeting',
        );
        expect(result.from).toBe('newsletter');
        expect(result.isUnread).toBe(true);
        expect(result.freeText).toBe('urgent meeting');
    });

    it('returns empty free text for an empty query', () => {
        expect(parseSearchQuery('').freeText).toBe('');
        expect(parseSearchQuery('   ').freeText).toBe('');
    });
});
