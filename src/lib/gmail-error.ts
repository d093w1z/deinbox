import { AppError } from './app-error';

// 1. Define the interface for Google API error objects
interface GapiError {
    code?: number;
    status?: string;
    reason?: string;
    message?: string;
    errors?: Array<{
        reason?: string;
        message?: string;
    }>;
    response?: {
        data?: {
            error?: GapiError;
        };
    };
}

export function mapGmailError(error: unknown): never {
    // 2. Cast the unknown error to our defined interface
    const err = error as GapiError;

    // 3. Extract the nested error object if it exists
    const gapiErr: GapiError =
        err?.response?.data?.error || err?.errors?.[0] || err;

    // 4. Safely extract properties
    const httpCode =
        typeof gapiErr?.code === 'number'
            ? gapiErr.code
            : typeof err?.code === 'number'
              ? err.code
              : undefined;
    const reason = gapiErr.errors?.[0]?.reason ?? gapiErr.reason ?? '';

    // AUTH / PERMISSION
    if (httpCode === 401 || reason === 'authError') {
        throw new AppError(
            'TOKEN_EXPIRED',
            'Google access token expired or invalid',
            401,
        );
    }

    if (reason === 'insufficientPermissions') {
        throw new AppError(
            'PERMISSION_DENIED',
            'Insufficient Gmail API permissions',
            403,
        );
    }

    if (reason === 'forbidden') {
        throw new AppError('FORBIDDEN', 'Access forbidden by Gmail API', 403);
    }

    // RATE LIMITS
    if (
        httpCode === 429 ||
        reason === 'rateLimitExceeded' ||
        reason === 'userRateLimitExceeded'
    ) {
        throw new AppError(
            'GMAIL_RATE_LIMITED',
            'Gmail API rate limit exceeded',
            429,
        );
    }

    // NOT FOUND / INVALID
    if (reason === 'notFound') {
        throw new AppError(
            'NOT_FOUND',
            'Requested Gmail resource not found',
            404,
        );
    }

    if (reason === 'invalidArgument' || reason === 'badRequest') {
        throw new AppError('BAD_REQUEST', 'Invalid Gmail API request', 400);
    }

    // CONFLICT / PRECONDITION
    if (reason === 'conflict' || reason === 'failedPrecondition') {
        throw new AppError(
            'FAILED_PRECONDITION',
            'Gmail API precondition failure',
            409,
        );
    }

    // BACKEND / SERVER ERRORS
    if ((httpCode && httpCode >= 500) || reason === 'backendError') {
        throw new AppError(
            'GMAIL_UPSTREAM_DOWN',
            'Gmail service internal error',
            502,
        );
    }

    // FALLBACK
    throw new AppError('UNKNOWN', 'Unhandled Gmail API error', httpCode ?? 500);
}
