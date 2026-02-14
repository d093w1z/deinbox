'use client';

import type { ApiErrorCode } from '@/types/errors';
import { UI_ERROR_MESSAGES } from '@/lib/ui-error-messages';
import { useMemo } from 'react';

interface ErrorProps {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}

interface ParsedError {
    code: ApiErrorCode;
    message: string;
    retryAfter?: number;
}

function parseError(error: Error): ParsedError {
    try {
        const parsed = JSON.parse(error.message) as ParsedError;
        if (parsed.code && parsed.message) {
            return parsed;
        }
    } catch {
        // ignore
    }

    return {
        code: 'UNKNOWN',
        message: error.message || 'An unexpected error occurred',
    };
}

export default function Error({ error }: ErrorProps) {
    const parsedError = useMemo(() => parseError(error), [error]);

    const code = parsedError.code;
    const userMessage = UI_ERROR_MESSAGES[code] ?? parsedError.message;

    return (
        <div className='flex flex-col items-center justify-center gap-6 p-4'>
            <div className='bg-card w-full max-w-md space-y-4 rounded-lg border p-6 shadow-lg'>
                <div className='flex items-center gap-3'>
                    <div className='bg-destructive/10 rounded-full p-3'>
                        <svg
                            className='text-destructive h-6 w-6'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                            />
                        </svg>
                    </div>
                    <div>
                        <h2 className='text-lg font-semibold'>
                            Failed to fetch analytics{' '}
                        </h2>
                    </div>
                </div>

                <p className='text-muted-foreground text-sm'>{userMessage}</p>
            </div>
        </div>
    );
}
