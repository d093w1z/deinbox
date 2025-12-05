import { z } from 'zod';

export const ProfileSchema = z.object({
  emailAddress: z.string().nullable().optional(),
  historyId: z.string().nullable().optional(),
  messagesTotal: z.number().nullable().optional(),
  threadsTotal: z.number().nullable().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;