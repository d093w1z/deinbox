'use client';

import { EmailTable } from '@/components/email-table';
import { NoSyncedData } from '@/components/no-synced-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmailSchema } from '@/types/EmailSchema';
import {
    IconHelpCircle,
    IconLoader,
    IconSearch,
    IconX,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { redirect } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

const MessagesResponseSchema = z.object({
    emails: z.array(EmailSchema),
    total: z.number(),
});

const FOLDERS = [
    { value: 'all', label: 'All Mail', gmailLabel: null },
    { value: 'inbox', label: 'Inbox', gmailLabel: 'INBOX' },
    { value: 'starred', label: 'Starred', gmailLabel: 'STARRED' },
    { value: 'sent', label: 'Sent', gmailLabel: 'SENT' },
    { value: 'spam', label: 'Spam', gmailLabel: 'SPAM' },
    { value: 'trash', label: 'Trash', gmailLabel: 'TRASH' },
] as const;

const CATEGORIES = [
    'all',
    'primary',
    'social',
    'promotions',
    'updates',
    'forums',
] as const;

export default function EmailsPage() {
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [emails, setEmails] = useState<z.infer<typeof EmailSchema>[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [neverSynced, setNeverSynced] = useState(false);

    const [q, setQ] = useState(searchParams.get('q') ?? '');
    const [searchInput, setSearchInput] = useState(q);
    const [folder, setFolder] = useState(searchParams.get('folder') ?? 'all');
    const [category, setCategory] = useState(
        searchParams.get('category') ?? 'all',
    );
    const [sender, setSender] = useState(searchParams.get('sender') ?? '');
    const [ids, setIds] = useState(searchParams.get('ids') ?? '');

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    // Debounce the free-text search box before it becomes the active query,
    // so we don't fire a request on every keystroke.
    useEffect(() => {
        const id = setTimeout(() => setQ(searchInput), 400);
        return () => clearTimeout(id);
    }, [searchInput]);

    // Keep the URL in sync so this view stays shareable/deep-linkable.
    useEffect(() => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (folder !== 'all') params.set('folder', folder);
        if (category !== 'all') params.set('category', category);
        if (sender) params.set('sender', sender);
        if (ids) params.set('ids', ids);
        const qs = params.toString();
        router.replace(qs ? `/emails?${qs}` : '/emails', { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, folder, category, sender, ids]);

    const gmailLabel = useMemo(
        () => FOLDERS.find((f) => f.value === folder)?.gmailLabel ?? null,
        [folder],
    );

    const fetchEmails = useCallback(
        async (signal: AbortSignal) => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams({ category });
                if (q) params.set('q', q);
                if (gmailLabel) params.set('label', gmailLabel);
                if (sender) params.set('sender', sender);
                if (ids) params.set('ids', ids);

                const res = await fetch(`/api/analytics/messages?${params}`, {
                    signal,
                });
                if (!res.ok) throw new Error('Failed to fetch');
                const json: unknown = await res.json();
                const data = MessagesResponseSchema.parse(json);
                setEmails(data.emails);
                setTotal(data.total);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                setError('Failed to load emails. Please try again.');
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        },
        [category, q, gmailLabel, sender, ids],
    );

    // Cancel any in-flight fetch when the filters change again before it
    // resolves, so a slow earlier response can't overwrite newer results.
    useEffect(() => {
        if (status !== 'authenticated') return;
        const controller = new AbortController();
        void fetchEmails(controller.signal);
        return () => controller.abort();
    }, [fetchEmails, status]);

    // Independent, unfiltered, one-time check so a filter combo that
    // legitimately matches zero emails isn't mistaken for "never synced".
    useEffect(() => {
        if (status !== 'authenticated') return;
        fetch('/api/analytics/messages?limit=1')
            .then((r) => r.json())
            .then((json: { total?: number }) =>
                setNeverSynced((json.total ?? 0) === 0),
            )
            .catch(() => {});
    }, [status]);

    if (neverSynced && !loading) {
        return (
            <NoSyncedData description='Emails are built from your synced inbox. Run a sync to browse them here.' />
        );
    }

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-center gap-3 px-4 lg:px-6'>
                <div className='relative flex-1 basis-64'>
                    <IconSearch className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder='Search, or try from:, subject:, before:2024-01-01…'
                        className='pl-8'
                    />
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type='button'
                            variant='outline'
                            size='icon'
                            className='size-9 shrink-0 rounded-full'
                            aria-label='Search syntax help'
                        >
                            <IconHelpCircle className='size-4' />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent
                        side='bottom'
                        align='start'
                        className='max-w-xs text-left'
                    >
                        <p className='mb-1 font-medium'>Search operators</p>
                        <ul className='space-y-0.5 text-xs'>
                            <li>
                                <code>from:name</code> — sender contains
                                &quot;name&quot;
                            </li>
                            <li>
                                <code>subject:text</code> — subject contains
                                &quot;text&quot;
                            </li>
                            <li>
                                <code>has:attachment</code> — has an attachment
                            </li>
                            <li>
                                <code>is:unread</code> / <code>is:read</code> /{' '}
                                <code>is:starred</code>
                            </li>
                            <li>
                                <code>before:2024-01-31</code> /{' '}
                                <code>after:2024-01-01</code>
                            </li>
                            <li>
                                <code>older_than:6m</code> /{' '}
                                <code>newer_than:7d</code> — d/m/y units
                            </li>
                            <li>
                                <code>category:promotions</code>,{' '}
                                <code>label:starred</code>
                            </li>
                        </ul>
                        <p className='text-muted-foreground mt-1 text-xs'>
                            Combine operators and plain words freely, e.g.{' '}
                            <code>
                                from:amazon has:attachment older_than:1y
                            </code>
                        </p>
                    </TooltipContent>
                </Tooltip>

                <Select value={folder} onValueChange={setFolder}>
                    <SelectTrigger size='sm' className='w-36'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {FOLDERS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                                {f.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger size='sm' className='w-36'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                                <span className='capitalize'>{c}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Badge variant='secondary' className='ml-auto'>
                    {loading ? '…' : total.toLocaleString('en-US')} emails
                </Badge>
            </div>

            {(sender || ids) && (
                <div className='flex flex-wrap gap-2 px-4 lg:px-6'>
                    {sender && (
                        <Badge variant='outline' className='gap-1.5 py-1.5'>
                            From: {sender}
                            <button
                                type='button'
                                onClick={() => setSender('')}
                                className='hover:text-destructive'
                                aria-label='Clear sender filter'
                            >
                                <IconX className='size-3.5' />
                            </button>
                        </Badge>
                    )}
                    {ids && (
                        <Badge variant='outline' className='gap-1.5 py-1.5'>
                            Preview of {ids.split(',').length} suggested email
                            {ids.split(',').length === 1 ? '' : 's'}
                            <button
                                type='button'
                                onClick={() => setIds('')}
                                className='hover:text-destructive'
                                aria-label='Clear preview filter'
                            >
                                <IconX className='size-3.5' />
                            </button>
                        </Badge>
                    )}
                </div>
            )}

            {error && (
                <p className='text-destructive px-4 text-sm lg:px-6'>{error}</p>
            )}

            {loading ? (
                <div className='text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm'>
                    <IconLoader className='size-4 animate-spin' />
                    Loading emails…
                </div>
            ) : emails.length === 0 ? (
                <p className='text-muted-foreground px-4 py-16 text-center text-sm lg:px-6'>
                    No emails match these filters.
                </p>
            ) : (
                <EmailTable data={emails} showCategoryTabs={false} />
            )}
        </div>
    );
}
