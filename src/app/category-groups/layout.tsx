import { PageShell } from '@/components/page-shell';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
    return <PageShell title='Category Groups'>{children}</PageShell>;
}
