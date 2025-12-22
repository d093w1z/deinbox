import { AppError } from '@/lib/app-error';
import { mapGmailError } from '@/lib/gmail-error';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function handleApiError(error: unknown): NextResponse {
    console.error('API Error:', error);

    // Handle AppError (our custom errors)
    if (error instanceof AppError) {
        return NextResponse.json(
            {
                code: error.code,
                message: error.message,
                retryAfter: error.extra?.retryAfter,
            },
            { status: error.status },
        );
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
        return NextResponse.json(
            {
                code: 'VALIDATION_ERROR',
                message: 'Invalid data format',
                details: error.issues,
            },
            { status: 400 },
        );
    }

    // Handle Gmail-specific errors
    if (
        error &&
        typeof error === 'object' &&
        ('response' in error || 'errors' in error)
    ) {
        try {
            mapGmailError(error);
        } catch (gmailErr) {
            if (gmailErr instanceof AppError) {
                return NextResponse.json(
                    {
                        code: gmailErr.code,
                        message: gmailErr.message,
                        retryAfter: gmailErr.extra?.retryAfter,
                    },
                    { status: gmailErr.status },
                );
            }
        }
    }

    // Handle standard Error
    if (error instanceof Error) {
        return NextResponse.json(
            {
                code: 'UNKNOWN',
                message:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : 'An unexpected error occurred',
            },
            { status: 500 },
        );
    }

    // Fallback for unknown errors
    return NextResponse.json(
        {
            code: 'UNKNOWN',
            message: 'An unexpected error occurred',
        },
        { status: 500 },
    );
}
