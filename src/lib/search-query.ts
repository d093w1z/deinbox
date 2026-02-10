// Parses a small subset of Gmail's search operators out of a free-text
// query string, leaving whatever's left over as plain-text search terms.
export interface ParsedSearchQuery {
    freeText: string;
    from?: string;
    subject?: string;
    hasAttachment?: boolean;
    isUnread?: boolean;
    isRead?: boolean;
    isStarred?: boolean;
    before?: string; // ISO date (YYYY-MM-DD)
    after?: string; // ISO date (YYYY-MM-DD)
    olderThanDays?: number;
    newerThanDays?: number;
    category?: string;
    label?: string;
}

function parseDate(value: string): string | undefined {
    const normalized = value.replace(/\//g, '-');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
}

function parseRelativeDays(value: string): number | undefined {
    const match = /^(\d+)([dmy])$/.exec(value);
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 'd') return amount;
    if (unit === 'm') return amount * 30;
    return amount * 365; // 'y'
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
    const result: ParsedSearchQuery = { freeText: '' };
    const freeTextParts: string[] = [];

    const tokens = raw.trim().split(/\s+/).filter(Boolean);

    for (const token of tokens) {
        const match = /^([a-zA-Z_]+):(.+)$/.exec(token);
        if (!match) {
            freeTextParts.push(token);
            continue;
        }

        const key = match[1].toLowerCase();
        const value = match[2].replace(/^"|"$/g, '');
        let recognized = true;

        switch (key) {
            case 'from':
                result.from = value;
                break;
            case 'subject':
                result.subject = value;
                break;
            case 'has':
                if (value === 'attachment') result.hasAttachment = true;
                else recognized = false;
                break;
            case 'is':
                if (value === 'unread') result.isUnread = true;
                else if (value === 'read') result.isRead = true;
                else if (value === 'starred') result.isStarred = true;
                else recognized = false;
                break;
            case 'before': {
                const parsed = parseDate(value);
                if (parsed) result.before = parsed;
                else recognized = false;
                break;
            }
            case 'after': {
                const parsed = parseDate(value);
                if (parsed) result.after = parsed;
                else recognized = false;
                break;
            }
            case 'older_than': {
                const days = parseRelativeDays(value);
                if (days) result.olderThanDays = days;
                else recognized = false;
                break;
            }
            case 'newer_than': {
                const days = parseRelativeDays(value);
                if (days) result.newerThanDays = days;
                else recognized = false;
                break;
            }
            case 'category':
                result.category = value;
                break;
            case 'label':
                result.label = value;
                break;
            default:
                recognized = false;
        }

        if (!recognized) freeTextParts.push(token);
    }

    result.freeText = freeTextParts.join(' ');
    return result;
}
