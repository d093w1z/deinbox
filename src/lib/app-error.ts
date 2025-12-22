import type { ApiError, ApiErrorCode } from '@/types/errors';

export class AppError extends Error {
    constructor(
        public code: ApiErrorCode,
        message: string,
        public status = 500,
        public extra?: Partial<ApiError>,
    ) {
        super(message);
        this.name = 'AppError';

        // CRITICAL: Set these properties for Next.js error boundary
        Object.defineProperty(this, 'code', {
            enumerable: true,
            value: code,
        });

        Object.defineProperty(this, 'retryAfter', {
            enumerable: true,
            value: extra?.retryAfter,
        });
    }

    // Ensure the error serializes properly
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            status: this.status,
            retryAfter: this.extra?.retryAfter,
        };
    }
}
