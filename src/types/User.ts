import { z } from 'zod';

export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().max(255),
    gmail_id: z.string().max(255),
    name: z.string().max(255).nullable().optional(),
    image: z.string().nullable().optional(),
    access_token_encrypted: z.string().nullable().optional(),
    refresh_token_encrypted: z.string().nullable().optional(),

    // BIGINT is typically handled as a bigint or string in TS to avoid precision loss
    history_id: z.union([z.bigint(), z.string()]).nullable().optional(),

    // PostgreSQL TIMESTAMP maps to Date objects in most drivers
    last_sync_at: z.coerce.date().nullable().optional(),

    // Enforcing the specific status strings allowed in your comment
    sync_status: z
        .enum(['pending', 'syncing', 'completed', 'failed'])
        .default('pending'),

    total_emails: z.number().int().nonnegative().default(0),

    created_at: z.coerce.date().default(() => new Date()),
    updated_at: z.coerce.date().default(() => new Date()),
});

// Extract the TypeScript type from the schema
export type User = z.infer<typeof UserSchema>;
export type Users = User[];
