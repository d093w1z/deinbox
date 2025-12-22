import { z } from 'zod';

export const API_ERROR_CODES = [
    'UNAUTHORIZED',
    'TOKEN_EXPIRED',
    'GMAIL_RATE_LIMITED',
    'GMAIL_UPSTREAM_DOWN',
    'GMAIL_BAD_QUERY',
    'CACHE_FAILURE',
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'FORBIDDEN',
    'BAD_REQUEST',
    'FAILED_PRECONDITION',
    'PERMISSION_DENIED',
    'JOB_NOT_FOUND',
    'UNKNOWN',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ApiErrorSchema = z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    status: z.number().optional(),
    retryAfter: z.number().optional(),
    userAction: z
        .object({
            label: z.string(),
            action: z.string(),
            //     .or(
            //     // a URL string
            //     z.function({
            //         // or a function type
            //         output: z.void(),
            //     }),
            // ),
        })
        .optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
