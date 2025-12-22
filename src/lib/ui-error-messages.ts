import type { ApiErrorCode } from '@/types/errors';

export const UI_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
    UNAUTHORIZED: 'Please sign in again.',
    TOKEN_EXPIRED: 'Your session expired. Reconnecting to Google.',
    GMAIL_RATE_LIMITED: 'Too many Gmail requests. Please wait a minute.',
    GMAIL_UPSTREAM_DOWN: 'Gmail is temporarily unavailable.',
    GMAIL_BAD_QUERY: 'Invalid email search query.',
    CACHE_FAILURE: 'Temporary server issue.',
    VALIDATION_ERROR: 'Some data is invalid.',
    NOT_FOUND: 'The requested resource was not found.',
    FORBIDDEN: 'You do not have permission to access this resource.',
    BAD_REQUEST: 'Invalid request. Please check your input.',
    FAILED_PRECONDITION: 'Request failed due to a precondition error.',
    PERMISSION_DENIED: 'Insufficient permissions to complete this action.',
    JOB_NOT_FOUND:
        'Sync has not been started yet. Please start syncing your emails using the below button.',
    UNKNOWN: 'Something went wrong.',
};
