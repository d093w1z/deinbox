import { z } from 'zod';

export const EmailSchema = z.object({
    id: z.string(),
    threadId: z.string(),
    snippet: z.string(),
    historyId: z.string(),
    internalDate: z.string(),
    subject: z.string(),
    from: z.string(),
    to: z.string(),
    date: z.date().or(z.string()),
    labels: z.array(z.string()),
    isUnread: z.boolean(),
    hasAttachment: z.boolean(),
    category: z.enum([
        'primary',
        'social',
        'promotions',
        'updates',
        'forums',
        'spam',
        'trash',
    ]),
    size: z.number(),
});

export type Email = z.infer<typeof EmailSchema>;
