import { db } from '@/lib/db';

// Shared progress-tracking helper for anything that runs as a background
// job against the sync_jobs table (email sync, suggestions generation).
export async function updateJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    progress: number,
    processedItems?: number,
    errorMessage?: string,
): Promise<void> {
    if (status === 'completed') {
        await db.query(
            `UPDATE sync_jobs
             SET status = $1, progress = $2,
                 processed_items = COALESCE($3, processed_items),
                 completed_at = NOW()
             WHERE id = $4`,
            [status, progress, processedItems ?? null, jobId],
        );
    } else if (status === 'failed') {
        await db.query(
            `UPDATE sync_jobs
             SET status = $1, progress = $2, error_message = $3,
                 completed_at = NOW()
             WHERE id = $4`,
            [status, progress, errorMessage, jobId],
        );
    } else {
        await db.query(
            `UPDATE sync_jobs
             SET status = $1, progress = $2, processed_items = $3,
                 started_at = COALESCE(started_at, NOW())
             WHERE id = $4`,
            [status, progress, processedItems ?? 0, jobId],
        );
    }
}
