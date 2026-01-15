// jobs/email-sync.queue.ts
import Bull from 'bull';

if (!process.env.REDIS_BULLMQ_URL) {
    throw new Error('REDIS_BULLMQ_URL is not set in environment variables.');
}

export interface EmailSyncJob {
    userId: string;
    syncType: 'full' | 'incremental' | 'suggestions';
    syncJobId: string;
    priority?: number;
}

// Create queue
export const emailSyncQueue = new Bull<EmailSyncJob>(
    'email-sync',
    process.env.REDIS_BULLMQ_URL,
    {
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 200, // Keep last 200 failed jobs
        },
    },
);

// Job priorities
export const PRIORITY = {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
};

// Add job to queue
export async function enqueueSyncJob(
    userId: string,
    syncType: 'full' | 'incremental' | 'suggestions',
    syncJobId: string,
    priority = PRIORITY.NORMAL,
) {
    return emailSyncQueue.add(
        { userId, syncType, syncJobId },
        {
            priority,
            jobId: `${userId}-${syncType}-${Date.now()}`, // Prevent duplicate jobs
        },
    );
}
