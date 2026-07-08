// workers/email-sync.worker.ts
import {
    emailSyncQueue,
    enqueueSyncJob,
    PRIORITY,
} from '../jobs/email-sync.queue';
import {
    EmailSyncService,
    SyncCancelledError,
} from '../services/email-sync.service';
import { SuggestionsService } from '../services/suggestions.service';
import { db } from '../lib/db';

const syncService = new EmailSyncService();
const suggestionsService = new SuggestionsService();

async function start() {
    // Process jobs
    await emailSyncQueue.process(5, async (job) => {
        const { userId, syncType, syncJobId } = job.data;
        const startedAt = Date.now();

        console.log(
            `[sync ${syncJobId}] starting ${syncType} for user ${userId}`,
        );

        try {
            if (syncType === 'full') {
                await syncService.performFullSync(userId, syncJobId);
            } else if (syncType === 'incremental') {
                await syncService.performIncrementalSync(userId, syncJobId);
            } else {
                await suggestionsService.generate(userId, syncJobId);
            }

            console.log(
                `[sync ${syncJobId}] finished in ${Date.now() - startedAt}ms`,
            );

            // A full/incremental sync just changed the data suggestions
            // are based on — regenerate them in the background so they
            // stay current without the user having to remember to.
            if (syncType === 'full' || syncType === 'incremental') {
                try {
                    const jobResult = await db.query<{ id: string }>(
                        `INSERT INTO sync_jobs (user_id, job_type, status)
                         VALUES ($1, 'suggestions', 'pending') RETURNING id`,
                        [userId],
                    );
                    await enqueueSyncJob(
                        userId,
                        'suggestions',
                        jobResult.rows[0].id,
                        PRIORITY.LOW,
                    );
                } catch (error) {
                    // Non-fatal: the sync itself succeeded. Most likely
                    // cause is the one-active-job-per-user unique index
                    // (a suggestions run is already queued/in progress).
                    console.warn(
                        `[sync ${syncJobId}] could not queue follow-up suggestions job:`,
                        error instanceof Error ? error.message : error,
                    );
                }
            }

            return { success: true, userId };
        } catch (error) {
            if (error instanceof SyncCancelledError) {
                // Already reflected in sync_jobs/users by /api/sync/cancel
                // — just make sure Bull doesn't auto-retry a job the user
                // deliberately stopped (defaultJobOptions.attempts: 3).
                console.log(
                    `[sync ${syncJobId}] cancelled by user after ${Date.now() - startedAt}ms`,
                );
                await job.discard();
                throw error;
            }
            console.error(
                `[sync ${syncJobId}] failed for user ${userId} after ${Date.now() - startedAt}ms:`,
                error instanceof Error ? error.message : error,
            );
            throw error;
        }
    });

    // Event listeners
    emailSyncQueue.on('completed', (job) => {
        console.log(`[sync ${job.data.syncJobId}] queue: completed`);
    });

    emailSyncQueue.on('failed', (job, err) => {
        console.error(
            `[sync ${job.data.syncJobId}] queue: failed - ${err.message}`,
        );
    });

    emailSyncQueue.on('stalled', (job) => {
        console.warn(`Sync job ${job.data.syncJobId} stalled`);
    });

    console.log('Email sync worker started');
}

void start();
