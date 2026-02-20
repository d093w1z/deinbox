'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { NoSyncedData } from '@/components/no-synced-data';
import { IconArchive, IconLoader, IconTrash } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SenderGroup {
    sender_email: string;
    sender_name: string | null;
    total_emails: number;
    unread_count: number;
    total_size_bytes: number;
    last_email_date: string;
    message_ids: string[];
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${'BKMG'[i]}B`.replace(
        'BB',
        'B',
    );
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

export default function SenderGroupsPage() {
    const { status } = useSession();
    const [groups, setGroups] = useState<SenderGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    useEffect(() => {
        if (status !== 'authenticated') return;
        fetch('/api/analytics/senders')
            .then((r) => r.json())
            .then((json: { senders: SenderGroup[] }) =>
                setGroups(json.senders ?? []),
            )
            .catch(() => setError('Failed to load senders.'))
            .finally(() => setLoading(false));
    }, [status]);

    const handleDelete = async (group: SenderGroup) => {
        setBusy(group.sender_email);
        const ok = await bulkAction('delete', group.message_ids);
        if (ok) {
            setGroups((prev) =>
                prev.filter((g) => g.sender_email !== group.sender_email),
            );
        }
        setBusy(null);
    };

    const handleArchive = async (group: SenderGroup) => {
        setBusy(group.sender_email);
        const ok = await bulkAction('archive', group.message_ids);
        if (ok) {
            setGroups((prev) =>
                prev.filter((g) => g.sender_email !== group.sender_email),
            );
        }
        setBusy(null);
    };

    if (loading) {
        return (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm'>
                <IconLoader className='size-4 animate-spin' />
                Loading senders…
            </div>
        );
    }

    if (error) {
        return <p className='text-destructive px-4 text-sm lg:px-6'>{error}</p>;
    }

    if (groups.length === 0) {
        return (
            <NoSyncedData description='Sender groups are built from your synced inbox. Run a sync to see senders here.' />
        );
    }

    return (
        <div className='px-4 lg:px-6'>
            <p className='text-muted-foreground mb-4 text-sm'>
                {groups.length} senders
            </p>
            <div className='overflow-hidden rounded-lg border'>
                <Table>
                    <TableHeader className='bg-muted sticky top-0 z-10'>
                        <TableRow>
                            <TableHead>Sender</TableHead>
                            <TableHead className='text-right'>Emails</TableHead>
                            <TableHead className='text-right'>Unread</TableHead>
                            <TableHead className='text-right'>Size</TableHead>
                            <TableHead className='text-right'>Last</TableHead>
                            <TableHead className='text-right'>
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.map((group) => (
                            <TableRow key={group.sender_email}>
                                <TableCell>
                                    <Link
                                        href={`/emails?sender=${encodeURIComponent(group.sender_email)}`}
                                        className='font-medium hover:underline'
                                    >
                                        {group.sender_name ||
                                            group.sender_email}
                                    </Link>
                                    <div className='text-muted-foreground truncate text-xs'>
                                        {group.sender_email}
                                    </div>
                                </TableCell>
                                <TableCell className='text-right'>
                                    <Badge variant='secondary'>
                                        {group.total_emails}
                                    </Badge>
                                </TableCell>
                                <TableCell className='text-right'>
                                    {group.unread_count > 0 && (
                                        <Badge variant='outline'>
                                            {group.unread_count}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className='text-muted-foreground text-right text-sm'>
                                    {formatBytes(group.total_size_bytes)}
                                </TableCell>
                                <TableCell className='text-muted-foreground text-right text-sm'>
                                    {new Date(
                                        group.last_email_date,
                                    ).toLocaleDateString('en-US')}
                                </TableCell>
                                <TableCell className='text-right'>
                                    <div className='flex justify-end gap-1'>
                                        <Button
                                            variant='outline'
                                            size='sm'
                                            disabled={
                                                busy === group.sender_email
                                            }
                                            onClick={() =>
                                                void handleArchive(group)
                                            }
                                        >
                                            <IconArchive className='size-3.5' />
                                        </Button>
                                        <Button
                                            variant='destructive'
                                            size='sm'
                                            disabled={
                                                busy === group.sender_email
                                            }
                                            onClick={() =>
                                                void handleDelete(group)
                                            }
                                        >
                                            <IconTrash className='size-3.5' />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
