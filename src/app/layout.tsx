import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import Providers from '@/components/sessionProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'DeInbox',
    description:
        ' DeInbox is a smart inbox cleaner for Gmail that helps you declutter your inbox, unsubscribe from junk, and manage your emails with intelligent filters and automation — all while prioritizing your privacy and security.',
};

function AppLoading() {
    return (
        <div className='text-muted-foreground flex h-screen items-center justify-center text-sm'>
            Loading application…
        </div>
    );
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang='en' suppressHydrationWarning>
            <head></head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider
                    attribute='class'
                    defaultTheme='system'
                    enableSystem
                    disableTransitionOnChange
                >
                    <Providers>
                        <Suspense fallback={<AppLoading />}>
                            {children}
                        </Suspense>
                        <Toaster />
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    );
}
