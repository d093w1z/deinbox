'use client';
import { GalleryVerticalEnd } from 'lucide-react';
import React from 'react';
import { LoginForm } from '@/components/login-form';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';

export default function LoginPage() {
    const { status } = useSession();
    if (status === 'authenticated') redirect('/sync-status');
    return (
        <div className='bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10'>
            <div className='flex w-full max-w-sm flex-col gap-6'>
                <a
                    href='#'
                    className='flex items-center gap-2 self-center font-medium'
                >
                    <div className='bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md'>
                        <Logo size={48} className='mx-auto' />
                    </div>
                    DeInbox
                </a>
                <LoginForm />
            </div>
        </div>
    );
}
