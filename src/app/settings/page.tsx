'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { IconLoader } from '@tabler/icons-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    const handleResync = async () => {
        setSyncing(true);
        setSyncMessage('');
        try {
            const res = await fetch('/api/sync/start', { method: 'POST' });
            const data = (await res.json()) as { error?: string };
            setSyncMessage(
                res.ok
                    ? 'Sync started. Check Sync Status for progress.'
                    : (data.error ?? 'Failed to start sync.'),
            );
        } catch {
            setSyncMessage('Failed to start sync.');
        } finally {
            setSyncing(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className='text-muted-foreground px-4 py-8 text-sm lg:px-6'>
                Loading…
            </div>
        );
    }

    const user = session?.user;

    return (
        <div className='flex flex-col gap-6 px-4 lg:px-6'>
            <Card>
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>
                        Your Google account linked to DeInbox.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-col gap-4'>
                    <div className='flex items-center gap-4'>
                        {user?.image && (
                            <Image
                                src={user.image}
                                alt='Avatar'
                                width={48}
                                height={48}
                                className='rounded-full'
                            />
                        )}
                        <div>
                            <p className='font-medium'>{user?.name}</p>
                            <p className='text-muted-foreground text-sm'>
                                {user?.email}
                            </p>
                        </div>
                    </div>
                    <Separator />
                    <div className='flex flex-col gap-1'>
                        <p className='text-sm font-medium'>Gmail Access</p>
                        <p className='text-muted-foreground text-sm'>
                            DeInbox can read, modify, and manage labels on your
                            Gmail messages. Tokens are stored encrypted and
                            refreshed automatically.
                        </p>
                    </div>
                    <Separator />
                    <div>
                        <Button
                            variant='destructive'
                            onClick={() =>
                                void signOut({ callbackUrl: '/login' })
                            }
                        >
                            Sign out
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sync</CardTitle>
                    <CardDescription>
                        Re-sync your Gmail messages into the local database used
                        for analytics.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-col gap-3'>
                    <div className='flex items-center gap-3'>
                        <Button
                            onClick={() => void handleResync()}
                            disabled={syncing}
                        >
                            {syncing ? (
                                <IconLoader className='size-4 animate-spin' />
                            ) : null}
                            Re-sync now
                        </Button>
                        <Link
                            href='/sync-status'
                            className='text-muted-foreground text-sm underline underline-offset-2'
                        >
                            View sync status
                        </Link>
                    </div>
                    {syncMessage && (
                        <p className='text-muted-foreground text-sm'>
                            {syncMessage}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cache</CardTitle>
                    <CardDescription>
                        Email data is cached in Redis for up to 5 minutes.
                        Navigating to pages after bulk actions clears the cache
                        automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className='text-muted-foreground text-sm'>
                        Cache is invalidated automatically after delete or
                        archive operations.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
