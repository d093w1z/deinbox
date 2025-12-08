import { AppSidebar } from '@/components/app-sidebar';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { DashboardContainer } from '@/components/dashboard-container';
import { GmailStatsResponseSchema } from '@/types/GmailStatsResponse';
import { cookies } from 'next/headers';

export default async function Page() {
    const session = await getServerSession();
    // console.log('Session in dashboard page:', session);
    if (!session) {
        redirect('/login');
    }
    const res = await fetch(new URL('/api/gmail', process.env.NEXTAUTH_URL!), {
        cache: 'no-store',
        headers: {
            Cookie: (await cookies()).toString(),
        },
    });

    const json = await res.json();

    // Zod validate once — on server
    const data = GmailStatsResponseSchema.parse(json);
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">
                                        Building Your Application
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>
                <DashboardContainer data={data} />
            </SidebarInset>
        </SidebarProvider>
    );
}
