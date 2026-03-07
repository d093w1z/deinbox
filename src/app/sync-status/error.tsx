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
    userAction?: {
        label: string;
        action: string | (() => void);
    };
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

export default function Error({ error, reset }: ErrorProps) {
    const parsedError = useMemo(() => parseError(error), [error]);

    const code = parsedError.code;
    const userMessage = UI_ERROR_MESSAGES[code] ?? parsedError.message;
    const userAction = parsedError.userAction;
    let action;
    if (typeof userAction?.action === 'function') {
        action = userAction?.action as () => void;
    } else if (typeof userAction?.action === 'string') {
        action = () =>
            (window.location.href = parsedError.userAction?.action as string);
    }

    return (
        <div className='flex min-h-screen flex-col items-center justify-center gap-6 p-4'>
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
                            Something went wrong
                        </h2>
                        <p className='text-muted-foreground text-sm'>
                            Error code: {code}
                        </p>
                    </div>
                </div>

                <p className='text-muted-foreground text-sm'>{userMessage}</p>

                {parsedError.retryAfter && (
                    <p className='text-sm font-medium text-orange-600 dark:text-orange-400'>
                        Please try again in {parsedError.retryAfter} seconds
                    </p>
                )}

                {error.digest && (
                    <p className='text-muted-foreground text-xs'>
                        Error ID:{' '}
                        <code className='bg-muted rounded px-1.5 py-0.5'>
                            {error.digest}
                        </code>
                    </p>
                )}

                {process.env.NODE_ENV === 'development' && (
                    <details className='bg-muted rounded-md p-3'>
                        <summary className='cursor-pointer text-sm font-medium'>
                            Debug Info (dev only)
                        </summary>
                        <pre className='mt-2 max-h-60 overflow-auto text-xs'>
                            {JSON.stringify(
                                {
                                    parsedError,
                                    originalMessage: error.message,
                                    name: error.name,
                                    stack: error.stack,
                                    digest: error.digest,
                                },
                                null,
                                2,
                            )}
                        </pre>
                    </details>
                )}

                <div className='flex gap-3 pt-2'>
                    <button
                        onClick={action ? action : reset}
                        className='bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium transition'
                    >
                        {parsedError.userAction
                            ? parsedError.userAction.label
                            : 'Try again'}
                    </button>
                    <button
                        onClick={() => (window.location.href = '/')}
                        className='bg-background hover:bg-accent flex-1 rounded-md border px-4 py-2 text-sm font-medium transition'
                    >
                        Go home
                    </button>
                </div>
            </div>
        </div>
    );
}
