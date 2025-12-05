import { z } from 'zod';
import { ProfileSchema } from './ProfileSchema';
import { EmailSchema } from './EmailSchema';

export const GmailStatsResponseSchema = z.object({
    emails: z.array(EmailSchema),

    profile: ProfileSchema,

    recentEmailCount: z.number(),

    stats: z.object({
        totalEmails: z.number(),
        unreadCount: z.number(),
        oldEmailsCount: z.number(),
        categoryCounts: z.record(z.string(), z.number()),
        senderFrequency: z.record(z.string(), z.number()),
        attachmentSize: z.number(),
    }),

    unsubscribeList: z.array(
        z.object({
            messageId: z.string(),
            unsubscribeUrl: z.string().optional(),
            unsubscribeEmail: z.string().optional(),
            sender: z.string(),
        }),
    ),

    error: z.string().nullable().optional(),
});

export type GmailStatsResponse = z.infer<typeof GmailStatsResponseSchema>;
