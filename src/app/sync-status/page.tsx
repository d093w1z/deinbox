'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { IconLoader, IconPlayerStop, IconRefresh } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SyncJob {
    id: string;
    status: string;
    job_type: string;
    progress?: number;
    total_items?: number;
    processed_items?: number;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
    created_at?: string;
}

interface OverviewResponse {
    overview: {
        total_emails: string | number;
        unread_count: string | number;
        total_size_bytes: string | number;
        unique_senders: string | number;
    };
    categoryBreakdown: {
        category: string;
        count: string | number;
    }[];
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${'BKMG'[i]}B`.replace(
        'BB',
        'B',
    );
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'text-yellow-600 dark:text-yellow-400',
    processing: 'text-blue-600 dark:text-blue-400',
    completed: 'text-green-600 dark:text-green-400',
    failed: 'text-destructive',
    cancelled: 'text-muted-foreground',
};

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export default function SyncStatusPage() {
    const { status: authStatus } = useSession();
    const [job, setJob] = useState<SyncJob | null>(null);
    const [history, setHistory] = useState<SyncJob[]>([]);
    const [overview, setOverview] = useState<OverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [startError, setStartError] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const [rate, setRate] = useState<number | null>(null); // items/sec
    const prevSampleRef = useRef<{ processed: number; t: number } | null>(null);

    if (authStatus === 'unauthenticated') {
        redirect('/login');
    }

    const fetchStatus = useCallback(async () => {
        const res = await fetch('/api/sync/status');
        if (res.status === 404) {
            setJob(null);
        } else if (res.ok) {
            const data = (await res.json()) as SyncJob;
            setJob(data);
        }
        setLoading(false);
    }, []);

    const fetchHistory = useCallback(async () => {
        const res = await fetch('/api/sync/history');
        if (res.ok) {
            const data = (await res.json()) as { jobs: SyncJob[] };
            setHistory(data.jobs);
        }
    }, []);

    useEffect(() => {
        if (authStatus !== 'authenticated') return;
        void fetchStatus();
        void fetchHistory();
    }, [authStatus, fetchStatus, fetchHistory]);

    // Poll while a job is actively running
    useEffect(() => {
        if (!job || TERMINAL_STATUSES.has(job.status)) return;
        const id = setInterval(() => void fetchStatus(), 5000);
        return () => clearInterval(id);
    }, [job, fetchStatus]);

    // Refresh history whenever the active job's status changes
    const jobStatus = job?.status;
    useEffect(() => {
        if (authStatus === 'authenticated') void fetchHistory();
    }, [jobStatus, authStatus, fetchHistory]);

    // Tick every second so elapsed time / ETA feel live between polls
    useEffect(() => {
        if (jobStatus !== 'processing') return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [jobStatus]);

    // Derive throughput from the delta between consecutive polls, not a
    // lifetime average since job start. The sync has two phases with very
    // different speeds (fast ID listing, then slow per-message fetches);
    // averaging over the whole elapsed time produces a wildly inflated
    // rate right at the phase boundary. A rolling delta reflects current
    // throughput instead, and a decrease in processed_items (the phase
    // boundary, where the counter restarts from 0) is treated as a fresh
    // baseline rather than a negative rate.
    useEffect(() => {
        if (!job || job.status !== 'processing') {
            prevSampleRef.current = null;
            setRate(null);
            return;
        }
        const processed = job.processed_items ?? 0;
        const t = Date.now();
        const prev = prevSampleRef.current;
        if (prev) {
            if (processed > prev.processed) {
                const deltaSeconds = (t - prev.t) / 1000;
                if (deltaSeconds > 0.5) {
                    setRate((processed - prev.processed) / deltaSeconds);
                }
            } else if (processed < prev.processed) {
                // Phase boundary: the counter restarted from 0. Drop the
                // stale rate and wait for a fresh baseline rather than
                // showing a nonsensical negative one.
                setRate(null);
            }
            // If unchanged, leave the last known rate showing instead of
            // blanking it out between polls that happened to land on the
            // same value.
        }
        prevSampleRef.current = { processed, t };
    }, [job]);

    // Post-sync inbox summary
    useEffect(() => {
        if (jobStatus !== 'completed') return;
        fetch('/api/analytics/overview')
            .then((r) => (r.ok ? r.json() : null))
            .then((data: OverviewResponse | null) => setOverview(data))
            .catch(() => {});
    }, [jobStatus]);

    const handleStartSync = async () => {
        setStarting(true);
        setStartError('');
        try {
            const res = await fetch('/api/sync/start', { method: 'POST' });
            if (res.ok) {
                await fetchStatus();
                await fetchHistory();
            } else {
                const data = (await res.json()) as { error?: string };
                setStartError(data.error ?? 'Failed to start sync.');
            }
        } catch {
            setStartError('Failed to start sync.');
        } finally {
            setStarting(false);
        }
    };

    const handleCancelSync = async () => {
        setCancelling(true);
        try {
            const res = await fetch('/api/sync/cancel', { method: 'POST' });
            if (res.ok) {
                await fetchStatus();
                await fetchHistory();
            }
        } catch {
            // Best-effort — the next poll will reflect the real state.
        } finally {
            setCancelling(false);
        }
    };

    const liveStats = useMemo(() => {
        if (!job || job.status !== 'processing' || !job.started_at) return null;
        const startedMs = new Date(job.started_at).getTime();
        const elapsedMs = now - startedMs;
        const processed = job.processed_items ?? 0;
        const total = job.total_items ?? 0;
        const remaining = Math.max(total - processed, 0);
        const etaMs = rate && rate > 0 ? (remaining / rate) * 1000 : null;
        return { elapsedMs, rate, etaMs };
    }, [job, now, rate]);

    if (authStatus === 'loading' || loading) {
        return (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm'>
                <IconLoader className='size-4 animate-spin' />
                Loading…
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-6 px-4 lg:px-6'>
            {!job ? (
                <Card>
                    <CardHeader>
                        <CardTitle>No Sync In Progress</CardTitle>
                        <CardDescription>
                            Sync your Gmail messages into the local database to
                            enable analytics and faster searches. This runs as a
                            background job.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className='flex flex-col items-start gap-3'>
                        {startError && (
                            <p className='text-destructive text-sm'>
                                {startError}
                            </p>
                        )}
                        <Button
                            onClick={() => void handleStartSync()}
                            disabled={starting}
                        >
                            {starting ? (
                                <IconLoader className='mr-2 size-4 animate-spin' />
                            ) : null}
                            Start Sync
                        </Button>
                    </CardFooter>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                            {job.status === 'processing' && (
                                <IconLoader className='size-5 animate-spin' />
                            )}
                            Sync Status
                        </CardTitle>
                        <CardDescription>
                            Job type:{' '}
                            <span className='capitalize'>
                                {job.job_type?.replace('_', ' ')}
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-3'>
                        <div className='text-sm'>
                            Status:{' '}
                            <span
                                className={`font-semibold capitalize ${STATUS_COLORS[job.status] ?? ''}`}
                            >
                                {job.status}
                            </span>
                        </div>
                        {typeof job.progress === 'number' && (
                            <div className='text-muted-foreground text-sm'>
                                {job.status === 'processing' &&
                                job.progress < 50 ? (
                                    // Phase 1: listing message ids. The
                                    // overall "progress" figure maps this
                                    // phase to 0-50%, but there's no
                                    // meaningful total yet (the real count
                                    // isn't known until listing finishes),
                                    // so show a running count instead of a
                                    // fraction that would double-count.
                                    <>
                                        Listing messages… (
                                        {job.processed_items ?? 0} found so far)
                                    </>
                                ) : job.total_items ? (
                                    // Phase 2 (or terminal state): a real
                                    // total is known, so processed/total is
                                    // a meaningful, self-consistent
                                    // fraction — use that as the
                                    // percentage instead of the backend's
                                    // phase-weighted number.
                                    <>
                                        {job.status === 'processing'
                                            ? 'Fetching message details: '
                                            : ''}
                                        {job.processed_items ?? 0} of{' '}
                                        {Math.max(
                                            job.total_items,
                                            job.processed_items ?? 0,
                                        )}{' '}
                                        emails (
                                        {Math.round(
                                            (Math.min(
                                                job.processed_items ?? 0,
                                                job.total_items,
                                            ) /
                                                job.total_items) *
                                                100,
                                        )}
                                        %)
                                    </>
                                ) : (
                                    `Progress: ${job.progress}%`
                                )}
                            </div>
                        )}
                        {liveStats && (
                            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                                <div>
                                    <p className='text-muted-foreground text-xs'>
                                        Elapsed
                                    </p>
                                    <p className='text-sm font-medium'>
                                        {formatDuration(liveStats.elapsedMs)}
                                    </p>
                                </div>
                                <div>
                                    <p className='text-muted-foreground text-xs'>
                                        Rate
                                    </p>
                                    <p className='text-sm font-medium'>
                                        {liveStats.rate != null &&
                                        liveStats.rate > 0
                                            ? `${Math.round(liveStats.rate * 60)}/min`
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className='text-muted-foreground text-xs'>
                                        Est. remaining
                                    </p>
                                    <p className='text-sm font-medium'>
                                        {liveStats.etaMs != null
                                            ? formatDuration(liveStats.etaMs)
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        )}
                        {job.error_message && (
                            <p className='text-destructive text-sm'>
                                {job.error_message}
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className='flex flex-col items-start gap-3'>
                        {(job.status === 'pending' ||
                            job.status === 'processing') && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => void handleCancelSync()}
                                disabled={cancelling}
                            >
                                {cancelling ? (
                                    <IconLoader className='mr-2 size-4 animate-spin' />
                                ) : (
                                    <IconPlayerStop className='mr-2 size-4' />
                                )}
                                Stop Sync
                            </Button>
                        )}
                        {TERMINAL_STATUSES.has(job.status) && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => void handleStartSync()}
                                disabled={starting}
                            >
                                <IconRefresh className='mr-2 size-4' />
                                Sync Again
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            )}

            {job?.status === 'completed' && overview && (
                <Card>
                    <CardHeader>
                        <CardTitle>Inbox Summary</CardTitle>
                        <CardDescription>
                            From your most recent sync.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-4'>
                        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    Total emails
                                </p>
                                <p className='text-lg font-semibold'>
                                    {Number(
                                        overview.overview.total_emails,
                                    ).toLocaleString('en-US')}
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    Unread
                                </p>
                                <p className='text-lg font-semibold'>
                                    {Number(
                                        overview.overview.unread_count,
                                    ).toLocaleString('en-US')}
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    Unique senders
                                </p>
                                <p className='text-lg font-semibold'>
                                    {Number(
                                        overview.overview.unique_senders,
                                    ).toLocaleString('en-US')}
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    Total size
                                </p>
                                <p className='text-lg font-semibold'>
                                    {formatBytes(
                                        Number(
                                            overview.overview.total_size_bytes,
                                        ),
                                    )}
                                </p>
                            </div>
                        </div>
                        {overview.categoryBreakdown?.length > 0 && (
                            <div className='flex flex-wrap gap-2'>
                                {overview.categoryBreakdown
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            Number(b.count) - Number(a.count),
                                    )
                                    .map((c) => (
                                        <Badge
                                            key={c.category}
                                            variant='secondary'
                                            className='capitalize'
                                        >
                                            {c.category}: {c.count}
                                        </Badge>
                                    ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {history.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sync History</CardTitle>
                        <CardDescription>
                            Your last {history.length} sync jobs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='overflow-hidden rounded-lg border'>
                            <Table>
                                <TableHeader className='bg-muted'>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className='text-right'>
                                            Emails
                                        </TableHead>
                                        <TableHead className='text-right'>
                                            Duration
                                        </TableHead>
                                        <TableHead className='text-right'>
                                            Started
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((h) => {
                                        const startSource =
                                            h.started_at ?? h.created_at;
                                        const start = startSource
                                            ? new Date(startSource).getTime()
                                            : null;
                                        const end = h.completed_at
                                            ? new Date(h.completed_at).getTime()
                                            : null;
                                        return (
                                            <TableRow key={h.id}>
                                                <TableCell className='capitalize'>
                                                    {h.job_type?.replace(
                                                        '_',
                                                        ' ',
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`text-sm font-medium capitalize ${STATUS_COLORS[h.status] ?? ''}`}
                                                    >
                                                        {h.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    {h.processed_items ?? 0}
                                                    {h.total_items
                                                        ? ` / ${h.total_items}`
                                                        : ''}
                                                </TableCell>
                                                <TableCell className='text-muted-foreground text-right text-sm'>
                                                    {start && end
                                                        ? formatDuration(
                                                              end - start,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className='text-muted-foreground text-right text-sm'>
                                                    {h.started_at ||
                                                    h.created_at
                                                        ? new Date(
                                                              h.started_at ??
                                                                  h.created_at!,
                                                          ).toLocaleString(
                                                              'en-US',
                                                          )
                                                        : '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
