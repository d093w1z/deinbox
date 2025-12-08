import { AppSidebar } from '@/components/app-sidebar';
import { Logo } from '@/components/logo';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
    Card,
    CardHeader,
    CardDescription,
    CardTitle,
    CardAction,
    CardFooter,
} from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { db } from '@/lib/db';
import { Separator } from '@radix-ui/react-separator';
import { LoaderIcon } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function SyncStatusPage() {
    const session = await getServerSession();
    // console.log('Session in dashboard page:', session);
    if (!session) {
        redirect('/login');
    }
    const user = await db.query('SELECT * FROM users');
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
                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            <Card className="@container/card">
                                <CardHeader>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        Sync Status Page{' '}
                                        <LoaderIcon className="mx-auto animate-spin inline" />
                                    </CardTitle>
                                    <CardDescription>
                                        Your data is being synchronized. Patience is
                                        appreciated!
                                    </CardDescription>
                                    <CardAction></CardAction>
                                </CardHeader>
                                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                                    <div className="text-muted-foreground"> </div>
                                </CardFooter>
                            </Card>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
