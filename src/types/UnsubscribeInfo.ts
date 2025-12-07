import { z } from 'zod';

export const UnsubscribeInfoSchema = z.object({
    messageId: z.string(),
    unsubscribeUrl: z.string().optional(),
    unsubscribeEmail: z.string().optional(),
    sender: z.string(),
});

export type UnsubscribeInfo = z.infer<typeof UnsubscribeInfoSchema>;
