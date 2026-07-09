'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { UnsubscribeInfo } from '@/types/UnsubscribeInfo';
import {
    IconCircleCheckFilled,
    IconLoader,
    IconMailOff,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface UnsubscribeState {
    [messageId: string]: 'pending' | 'done' | 'error';
}

// Shows a tooltip with the full text only when the text is actually
// truncated (measured via DOM overflow), not just whenever it's long.
function TruncatedText({
    text,
    className,
}: {
    text: string;
    className?: string;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setIsTruncated(el.scrollWidth > el.clientWidth);
    }, [text]);

    const content = (
        <span ref={ref} className={cn('block truncate', className)}>
            {text}
        </span>
    );

    if (!isTruncated) return content;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side='top' className='max-w-xs break-all'>
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

export default function UnsubscribePage() {
    const { status } = useSession();
    const [list, setList] = useState<UnsubscribeInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [states, setStates] = useState<UnsubscribeState>({});

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    useEffect(() => {
        if (status !== 'authenticated') return;
        fetch('/api/gmail/unsubscribe')
            .then((r) => r.json())
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setList(data as UnsubscribeInfo[]);
                } else {
                    setError('Unexpected response format.');
                }
            })
            .catch(() =>
                setError('Failed to load unsubscribe list. Please try again.'),
            )
            .finally(() => setLoading(false));
    }, [status]);

    const handleUnsubscribe = async (item: UnsubscribeInfo) => {
        if (!item.unsubscribeUrl) return;
        setStates((s) => ({ ...s, [item.messageId]: 'pending' }));
        try {
            const res = await fetch('/api/gmail/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.unsubscribeUrl }),
            });
            setStates((s) => ({
                ...s,
                [item.messageId]: res.ok ? 'done' : 'error',
            }));
        } catch {
            setStates((s) => ({ ...s, [item.messageId]: 'error' }));
        }
    };

    if (loading) {
        return (
            <div className='flex flex-col items-center justify-center gap-3 py-20'>
                <IconLoader className='text-muted-foreground size-8 animate-spin' />
                <p className='text-muted-foreground text-sm'>
                    Scanning promotional emails for unsubscribe links…
                </p>
                <p className='text-muted-foreground text-xs'>
                    This may take up to a minute on first load.
                </p>
            </div>
        );
    }

    if (error) {
        return <p className='text-destructive px-4 text-sm lg:px-6'>{error}</p>;
    }

    if (list.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center gap-3 py-20'>
                <IconMailOff className='text-muted-foreground size-10' />
                <p className='text-muted-foreground text-sm'>
                    No unsubscribe links found in recent promotional emails.
                </p>
            </div>
        );
    }

    const doneCount = Object.values(states).filter((s) => s === 'done').length;

    return (
        <div className='flex flex-col gap-6 px-4 lg:px-6'>
            <Card>
                <CardHeader>
                    <CardTitle>Newsletter &amp; Mailing List Senders</CardTitle>
                    <CardDescription>
                        {list.length} senders with unsubscribe links detected in
                        your promotional emails.
                        {doneCount > 0 && ` ${doneCount} unsubscribed.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                    <div className='overflow-hidden rounded-b-lg'>
                        <Table className='table-fixed'>
                            <TableHeader className='bg-muted'>
                                <TableRow>
                                    <TableHead className='w-40 sm:w-48'>
                                        Sender
                                    </TableHead>
                                    <TableHead>Unsubscribe via</TableHead>
                                    <TableHead className='w-28 text-right sm:w-40'>
                                        Action
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {list.map((item) => {
                                    const state = states[item.messageId];
                                    const via =
                                        item.unsubscribeUrl ??
                                        item.unsubscribeEmail;
                                    return (
                                        <TableRow key={item.messageId}>
                                            <TableCell className='whitespace-normal'>
                                                <Link
                                                    href={`/emails?sender=${encodeURIComponent(item.sender)}`}
                                                    className='hover:underline'
                                                >
                                                    <TruncatedText
                                                        text={item.sender}
                                                        className='text-sm font-medium'
                                                    />
                                                </Link>
                                            </TableCell>
                                            <TableCell className='whitespace-normal'>
                                                {via ? (
                                                    <TruncatedText
                                                        text={via}
                                                        className='text-muted-foreground text-xs'
                                                    />
                                                ) : null}
                                            </TableCell>
                                            <TableCell className='text-right'>
                                                {state === 'done' ? (
                                                    <span className='flex items-center justify-end gap-1 text-sm text-green-600 dark:text-green-400'>
                                                        <IconCircleCheckFilled className='size-4' />
                                                        Unsubscribed
                                                    </span>
                                                ) : item.unsubscribeUrl ? (
                                                    <Button
                                                        size='sm'
                                                        variant={
                                                            state === 'error'
                                                                ? 'destructive'
                                                                : 'outline'
                                                        }
                                                        disabled={
                                                            state === 'pending'
                                                        }
                                                        onClick={() =>
                                                            void handleUnsubscribe(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        {state === 'pending' ? (
                                                            <IconLoader className='size-3.5 animate-spin' />
                                                        ) : state ===
                                                          'error' ? (
                                                            'Retry'
                                                        ) : (
                                                            'Unsubscribe'
                                                        )}
                                                    </Button>
                                                ) : item.unsubscribeEmail ? (
                                                    <a
                                                        href={`mailto:${item.unsubscribeEmail}`}
                                                        className='text-primary text-sm underline-offset-4 hover:underline'
                                                    >
                                                        Email to unsubscribe
                                                    </a>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
