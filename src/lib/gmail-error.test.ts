import { describe, expect, it } from 'vitest';
import { AppError } from './app-error';
import { mapGmailError } from './gmail-error';

function expectAppError(
    fn: () => void,
    code: string,
    status: number,
): AppError {
    try {
        fn();
    } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe(code);
        expect(appErr.status).toBe(status);
        return appErr;
    }
    throw new Error('expected mapGmailError to throw');
}

describe('mapGmailError', () => {
    it('maps a 401 to TOKEN_EXPIRED', () => {
        expectAppError(
            () => mapGmailError({ code: 401 }),
            'TOKEN_EXPIRED',
            401,
        );
    });

    it('maps insufficientPermissions reason to PERMISSION_DENIED', () => {
        expectAppError(
            () =>
                mapGmailError({
                    errors: [{ reason: 'insufficientPermissions' }],
                }),
            'PERMISSION_DENIED',
            403,
        );
    });

    it('maps a 429 to GMAIL_RATE_LIMITED', () => {
        expectAppError(
            () => mapGmailError({ code: 429 }),
            'GMAIL_RATE_LIMITED',
            429,
        );
    });

    it('maps notFound reason to NOT_FOUND', () => {
        expectAppError(
            () => mapGmailError({ errors: [{ reason: 'notFound' }] }),
            'NOT_FOUND',
            404,
        );
    });

    it('maps a nested response.data.error shape', () => {
        expectAppError(
            () =>
                mapGmailError({
                    response: { data: { error: { code: 401 } } },
                }),
            'TOKEN_EXPIRED',
            401,
        );
    });

    it('maps a 5xx to GMAIL_UPSTREAM_DOWN', () => {
        expectAppError(
            () => mapGmailError({ code: 503 }),
            'GMAIL_UPSTREAM_DOWN',
            502,
        );
    });

    it('falls back to UNKNOWN for unrecognized errors', () => {
        expectAppError(() => mapGmailError({}), 'UNKNOWN', 500);
    });
});
