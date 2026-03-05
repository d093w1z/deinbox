'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { CleanupSuggestion } from '@/lib/ai-categorizer';
import {
    IconArchive,
    IconCircleCheckFilled,
    IconDatabase,
    IconEye,
    IconLoader,
    IconMail,
    IconMailOff,
    IconRefresh,
    IconSparkles,
    IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SmartFilter {
    name: string;
    description: string;
    estimatedImpact: string;
    messageIds: string[];
}

interface SuggestionsResult {
    suggestions: CleanupSuggestion[];
    smartFilters: SmartFilter[];
    generatedAt: string;
    emailsAnalyzed: number;
}

interface Job {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    total_items: number | null;
    processed_items: number;
    error_message: string | null;
    created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    promotional: 'Promotional',
    newsletter: 'Newsletter',
    social: 'Social',
    spam: 'Spam',
    attachments: 'Attachments',
    unread: 'Unread',
    transactional: 'Receipts',
};

const ACTION_META: Record<
    string,
    {
        icon: typeof IconTrash;
        label: string;
        buttonVariant: 'destructive' | 'outline';
    }
> = {
    delete: { icon: IconTrash, label: 'Delete', buttonVariant: 'destructive' },
    archive: { icon: IconArchive, label: 'Archive', buttonVariant: 'outline' },
    unsubscribe: {
        icon: IconMailOff,
        label: 'Review',
        buttonVariant: 'outline',
    },
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${'BKMG'[i]}B`.replace(
        'BB',
        'B',
    );
}

function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

async function bulkAction(
    action: 'delete' | 'archive',
    messageIds: string[],
): Promise<boolean> {
    const res = await fetch('/api/gmail/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageIds }),
    });
    return res.ok;
}

// Keeps the URL to a sane length for suggestions with a lot of matches —
// this is a preview, not required to include every single affected email.
const MAX_PREVIEW_IDS = 100;

function previewHref(messageIds: string[]): string {
    const capped = messageIds.slice(0, MAX_PREVIEW_IDS);
    return `/emails?ids=${capped.map(encodeURIComponent).join(',')}`;
}

function PreviewLink({ messageIds }: { messageIds: string[] }) {
    return (
        <Button asChild variant='ghost' size='sm'>
            <Link href={previewHref(messageIds)}>
                <IconEye className='size-3.5' />
                Preview
            </Link>
        </Button>
    );
}

interface ActionCardProps {
    icon: typeof IconTrash;
    title: string;
    subtitle?: string;
    emailsAffected: number;
    spaceFreed?: number;
    confidence?: number;
    done: boolean;
    children: ReactNode;
}

function ActionCard({
    icon: Icon,
    title,
    subtitle,
    emailsAffected,
    spaceFreed,
    confidence,
    done,
    children,
}: ActionCardProps) {
    return (
        <Card className={done ? 'opacity-60' : undefined}>
            <CardContent className='flex flex-wrap items-center gap-4 px-5 py-4'>
                <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full'>
                    <Icon className='size-5' />
                </div>
                <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{title}</p>
                    <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                        <Badge variant='secondary' className='gap-1'>
                            <IconMail className='size-3' />
                            {emailsAffected}
                        </Badge>
                        {!!spaceFreed && (
                            <Badge variant='secondary' className='gap-1'>
                                <IconDatabase className='size-3' />
                                {formatBytes(spaceFreed)}
                            </Badge>
                        )}
                        {confidence != null && (
                            <Badge variant='outline'>
                                {Math.round(confidence * 100)}% confident
                            </Badge>
                        )}
                        {subtitle && (
                            <span className='text-muted-foreground text-xs'>
                                {subtitle}
                            </span>
                        )}
                    </div>
                </div>
                <div className='shrink-0'>
                    {done ? (
                        <span className='text-muted-foreground flex items-center gap-1 text-sm'>
                            <IconCircleCheckFilled className='size-4 text-green-600 dark:text-green-400' />
                            Done
                        </span>
                    ) : (
                        children
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function SuggestionsPage() {
    const { status } = useSession();
    const [result, setResult] = useState<SuggestionsResult | null>(null);
    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [handled, setHandled] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState<{
        key: string;
        label: string;
        count: number;
        messageIds: string[];
    } | null>(null);

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/suggestions');
            if (!res.ok) throw new Error('Failed to fetch');
            const json = (await res.json()) as {
                result: SuggestionsResult | null;
                job: Job | null;
            };
            setResult(json.result);
            setJob(json.job);
        } catch {
            setError('Failed to load suggestions.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'authenticated') void fetchStatus();
    }, [status, fetchStatus]);

    // Poll while a job is actively running, so a fresh result (or one
    // triggered automatically after a sync) shows up without a refresh.
    useEffect(() => {
        if (!job || job.status === 'completed' || job.status === 'failed')
            return;
        const id = setInterval(() => void fetchStatus(), 5000);
        return () => clearInterval(id);
    }, [job, fetchStatus]);

    const handleGenerate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await fetch('/api/suggestions/generate', {
                method: 'POST',
            });
            if (res.ok) {
                await fetchStatus();
            } else {
                const data = (await res.json()) as { error?: string };
                setError(
                    data.error ?? 'Failed to start suggestions generation.',
                );
            }
        } catch {
            setError('Failed to start suggestions generation.');
        } finally {
            setGenerating(false);
        }
    };

    const runAction = async (
        key: string,
        action: 'delete' | 'archive',
        messageIds: string[],
        label: string,
    ) => {
        setBusy(key);
        const ok = await bulkAction(action, messageIds);
        if (ok) {
            setHandled((prev) => new Set(prev).add(key));
            toast.success(
                `${action === 'delete' ? 'Deleted' : 'Archived'} ${messageIds.length} email${messageIds.length === 1 ? '' : 's'}`,
                { description: label },
            );
        } else {
            toast.error(`Failed to ${action} emails`, { description: label });
        }
        setBusy(null);
    };

    const handleAction = (
        key: string,
        action: 'delete' | 'archive',
        messageIds: string[],
        label: string,
    ) => {
        if (action === 'delete') {
            setConfirming({ key, label, count: messageIds.length, messageIds });
            return;
        }
        void runAction(key, action, messageIds, label);
    };

    if (loading) {
        return (
            <div className='flex flex-col items-center justify-center gap-3 py-24'>
                <IconSparkles className='text-muted-foreground size-8 animate-pulse' />
                <p className='text-muted-foreground text-sm'>
                    Loading suggestions…
                </p>
            </div>
        );
    }

    const jobIsActive =
        job && (job.status === 'pending' || job.status === 'processing');

    // Nothing has ever been generated yet, and nothing is running: prompt
    // to kick off the first analysis.
    if (!result && !jobIsActive) {
        return (
            <div className='flex flex-col items-center justify-center gap-3 px-4 py-24 text-center'>
                <IconSparkles className='text-muted-foreground size-10' />
                <p className='text-sm font-medium'>
                    Suggestions haven&apos;t been generated yet
                </p>
                <p className='text-muted-foreground max-w-sm text-sm'>
                    This runs as a background job over your full synced inbox,
                    not just what happens to be on screen. It also runs
                    automatically after every sync.
                </p>
                {(error || job?.status === 'failed') && (
                    <p className='text-destructive text-sm'>
                        {error || job?.error_message}
                    </p>
                )}
                <Button
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                >
                    {generating ? (
                        <IconLoader className='size-4 animate-spin' />
                    ) : (
                        <IconSparkles className='size-4' />
                    )}
                    Generate suggestions
                </Button>
            </div>
        );
    }

    // A job is running and there's no previous result to show meanwhile.
    if (!result && jobIsActive) {
        const pct =
            job.status === 'processing' && job.total_items
                ? Math.round((job.processed_items / job.total_items) * 100)
                : null;
        return (
            <div className='flex flex-col items-center justify-center gap-3 px-4 py-24 text-center'>
                <IconLoader className='text-muted-foreground size-8 animate-spin' />
                <p className='text-sm font-medium'>Analyzing your inbox…</p>
                <p className='text-muted-foreground text-sm'>
                    {job.total_items
                        ? `${job.processed_items.toLocaleString('en-US')} of ${job.total_items.toLocaleString('en-US')} emails${pct != null ? ` (${pct}%)` : ''}`
                        : 'Starting…'}
                </p>
            </div>
        );
    }

    const suggestions = result?.suggestions ?? [];
    const activeFilters = (result?.smartFilters ?? []).filter(
        (f) => f.messageIds.length > 0,
    );

    const pendingSuggestions = suggestions.filter(
        (_, i) => !handled.has(`suggestion-${i}`),
    );
    const totalEmails = pendingSuggestions.reduce(
        (sum, s) => sum + s.impact.emailsAffected,
        0,
    );
    const totalSpace = pendingSuggestions.reduce(
        (sum, s) => sum + s.impact.spaceFreed,
        0,
    );

    return (
        <div className='flex flex-col gap-8 px-4 lg:px-6'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-muted-foreground text-sm'>
                    {result && (
                        <>
                            Analyzed{' '}
                            {result.emailsAnalyzed.toLocaleString('en-US')}{' '}
                            emails · Generated{' '}
                            {formatRelativeTime(result.generatedAt)}
                            {jobIsActive && ' · Refreshing in the background…'}
                        </>
                    )}
                </p>
                <Button
                    variant='outline'
                    size='sm'
                    onClick={() => void handleGenerate()}
                    disabled={generating || !!jobIsActive}
                >
                    {generating || jobIsActive ? (
                        <IconLoader className='size-3.5 animate-spin' />
                    ) : (
                        <IconRefresh className='size-3.5' />
                    )}
                    Regenerate
                </Button>
            </div>

            {error && <p className='text-destructive text-sm'>{error}</p>}

            {suggestions.length === 0 && activeFilters.length === 0 ? (
                <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
                    <IconCircleCheckFilled className='size-10 text-green-600 dark:text-green-400' />
                    <p className='text-sm font-medium'>Your inbox looks tidy</p>
                    <p className='text-muted-foreground max-w-sm text-sm'>
                        No cleanup suggestions right now.
                    </p>
                </div>
            ) : (
                <>
                    {suggestions.length > 0 && (
                        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                            <Card>
                                <CardHeader className='gap-1 px-4'>
                                    <p className='text-muted-foreground text-xs'>
                                        Suggestions left
                                    </p>
                                    <p className='text-2xl font-semibold'>
                                        {pendingSuggestions.length}
                                    </p>
                                </CardHeader>
                            </Card>
                            <Card>
                                <CardHeader className='gap-1 px-4'>
                                    <p className='text-muted-foreground text-xs'>
                                        Emails affected
                                    </p>
                                    <p className='text-2xl font-semibold'>
                                        {totalEmails.toLocaleString('en-US')}
                                    </p>
                                </CardHeader>
                            </Card>
                            <Card className='col-span-2 sm:col-span-1'>
                                <CardHeader className='gap-1 px-4'>
                                    <p className='text-muted-foreground text-xs'>
                                        Space you could free
                                    </p>
                                    <p className='text-2xl font-semibold'>
                                        {formatBytes(totalSpace)}
                                    </p>
                                </CardHeader>
                            </Card>
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <div>
                            <h2 className='mb-3 flex items-center gap-1.5 text-lg font-medium'>
                                <IconSparkles className='text-muted-foreground size-5' />
                                Cleanup suggestions
                            </h2>
                            <div className='flex flex-col gap-2'>
                                {suggestions.map((suggestion, i) => {
                                    const key = `suggestion-${i}`;
                                    const isHandled = handled.has(key);
                                    const meta =
                                        ACTION_META[suggestion.action] ??
                                        ACTION_META.archive;

                                    return (
                                        <ActionCard
                                            key={key}
                                            icon={meta.icon}
                                            title={suggestion.reason}
                                            subtitle={
                                                CATEGORY_LABELS[
                                                    suggestion.impact.category
                                                ] ?? suggestion.impact.category
                                            }
                                            emailsAffected={
                                                suggestion.impact.emailsAffected
                                            }
                                            spaceFreed={
                                                suggestion.impact.spaceFreed
                                            }
                                            confidence={suggestion.confidence}
                                            done={isHandled}
                                        >
                                            <div className='flex items-center gap-1.5'>
                                                {suggestion.action ===
                                                'unsubscribe' ? (
                                                    <Button
                                                        asChild
                                                        variant='outline'
                                                        size='sm'
                                                    >
                                                        <Link
                                                            href={
                                                                suggestion.sender
                                                                    ? `/emails?sender=${encodeURIComponent(suggestion.sender)}`
                                                                    : previewHref(
                                                                          suggestion.messageIds,
                                                                      )
                                                            }
                                                        >
                                                            Review
                                                        </Link>
                                                    </Button>
                                                ) : suggestion.action ===
                                                  'keep' ? null : (
                                                    <>
                                                        <PreviewLink
                                                            messageIds={
                                                                suggestion.messageIds
                                                            }
                                                        />
                                                        <Button
                                                            variant={
                                                                meta.buttonVariant
                                                            }
                                                            size='sm'
                                                            disabled={
                                                                busy === key
                                                            }
                                                            onClick={() =>
                                                                handleAction(
                                                                    key,
                                                                    suggestion.action as
                                                                        | 'delete'
                                                                        | 'archive',
                                                                    suggestion.messageIds,
                                                                    suggestion.reason,
                                                                )
                                                            }
                                                        >
                                                            {busy === key ? (
                                                                <IconLoader className='size-3.5 animate-spin' />
                                                            ) : (
                                                                <meta.icon className='size-3.5' />
                                                            )}
                                                            {meta.label}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </ActionCard>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeFilters.length > 0 && (
                        <div>
                            <h2 className='mb-1 text-lg font-medium'>
                                Smart filters
                            </h2>
                            <p className='text-muted-foreground mb-3 text-sm'>
                                Built-in filters you can apply in one click.
                            </p>
                            <div className='flex flex-col gap-2'>
                                {activeFilters.map((filter) => {
                                    const key = `filter-${filter.name}`;
                                    const isHandled = handled.has(key);
                                    return (
                                        <ActionCard
                                            key={key}
                                            icon={IconArchive}
                                            title={filter.name}
                                            subtitle={filter.description}
                                            emailsAffected={
                                                filter.messageIds.length
                                            }
                                            done={isHandled}
                                        >
                                            <div className='flex gap-1.5'>
                                                <PreviewLink
                                                    messageIds={
                                                        filter.messageIds
                                                    }
                                                />
                                                <Button
                                                    variant='outline'
                                                    size='sm'
                                                    disabled={busy === key}
                                                    onClick={() =>
                                                        handleAction(
                                                            key,
                                                            'archive',
                                                            filter.messageIds,
                                                            filter.name,
                                                        )
                                                    }
                                                >
                                                    {busy === key ? (
                                                        <IconLoader className='size-3.5 animate-spin' />
                                                    ) : (
                                                        <IconArchive className='size-3.5' />
                                                    )}
                                                    Archive
                                                </Button>
                                                <Button
                                                    variant='destructive'
                                                    size='sm'
                                                    disabled={busy === key}
                                                    onClick={() =>
                                                        handleAction(
                                                            key,
                                                            'delete',
                                                            filter.messageIds,
                                                            filter.name,
                                                        )
                                                    }
                                                >
                                                    <IconTrash className='size-3.5' />
                                                    Delete
                                                </Button>
                                            </div>
                                        </ActionCard>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Dialog
                open={!!confirming}
                onOpenChange={(open) => !open && setConfirming(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete these emails?</DialogTitle>
                        <DialogDescription>
                            {confirming &&
                                `This will permanently delete ${confirming.count} email${confirming.count === 1 ? '' : 's'} (${confirming.label}). This can't be undone.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant='outline'
                            onClick={() => setConfirming(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={() => {
                                if (!confirming) return;
                                const { key, messageIds, label } = confirming;
                                setConfirming(null);
                                void runAction(
                                    key,
                                    'delete',
                                    messageIds,
                                    label,
                                );
                            }}
                        >
                            <IconTrash className='size-3.5' />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
