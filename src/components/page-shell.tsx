import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

export async function PageShell({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <SidebarInset>
                <header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
                    <div className='flex items-center gap-2 px-4'>
                        <SidebarTrigger className='-ml-1' />
                        <Separator
                            orientation='vertical'
                            className='mr-2 h-4'
                        />
                        <span className='text-sm font-medium'>{title}</span>
                    </div>
                </header>
                <div className='@container/main flex flex-1 flex-col gap-2'>
                    <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
                        {children}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
