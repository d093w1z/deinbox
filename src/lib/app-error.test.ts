import { describe, expect, it } from 'vitest';
import { AppError } from './app-error';

describe('AppError', () => {
    it('carries code, message, and status', () => {
        const err = new AppError('NOT_FOUND', 'missing', 404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toBe('missing');
        expect(err.status).toBe(404);
        expect(err).toBeInstanceOf(Error);
    });

    it('defaults status to 500', () => {
        const err = new AppError('UNKNOWN', 'oops');
        expect(err.status).toBe(500);
    });

    it('serializes to JSON with retryAfter from extra', () => {
        const err = new AppError('GMAIL_RATE_LIMITED', 'slow down', 429, {
            retryAfter: 30,
        });
        expect(err.toJSON()).toEqual({
            name: 'AppError',
            message: 'slow down',
            code: 'GMAIL_RATE_LIMITED',
            status: 429,
            retryAfter: 30,
        });
    });
});
