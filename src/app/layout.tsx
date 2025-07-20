// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import '@mantine/core/styles.css';
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}
