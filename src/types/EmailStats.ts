import { z } from 'zod';

export const EmailStatsSchema = z.object({
    totalEmails: z.number(),
    unreadCount: z.number(),
    oldEmailsCount: z.number(),
    categoryCounts: z.record(z.string(), z.number()),
    senderFrequency: z.record(z.string(), z.number()),
    attachmentSize: z.number(),
});

export type EmailStats = z.infer<typeof EmailStatsSchema>;
