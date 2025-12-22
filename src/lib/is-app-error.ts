import type { AppError } from './app-error';

export function isAppError(error: unknown): error is AppError {
    const e = error as AppError; // Single cast for the whole block
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'status' in error &&
        typeof e.code === 'string'
    );
}
