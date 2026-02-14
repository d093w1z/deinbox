import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { MonthlyEmailChart } from '@/components/monthly-email-chart';
import {
    IconArchive,
    IconDatabase,
    IconMail,
    IconMailOff,
    IconSparkles,
    IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';

interface OverviewStats {
    total_emails: string | number;
    unread_count: string | number;
    total_size_bytes: string | number;
    unique_senders: string | number;
}

interface TopSender {
    sender_email: string;
    sender_name: string | null;
    total_emails: number;
    unread_count: number;
}

interface CategoryBreakdown {
    category: string;
    count: string | number;
}

interface StorageByCategoryRow {
    month: string | Date;
    category: string;
    count: string | number;
}

export interface DashboardOverviewData {
    overview: OverviewStats;
    topSenders: TopSender[];
    categoryBreakdown: CategoryBreakdown[];
    storageByCategory: StorageByCategoryRow[];
}

const CATEGORY_LABELS: Record<string, string> = {
    primary: 'Primary',
    social: 'Social',
    promotions: 'Promotions',
    updates: 'Updates',
    forums: 'Forums',
    spam: 'Spam',
    trash: 'Trash',
};

const QUICK_ACTIONS = [
    {
        href: '/suggestions',
        label: 'Suggestions',
        description: 'AI cleanup ideas',
        icon: IconSparkles,
    },
    {
        href: '/emails',
        label: 'Browse Emails',
        description: 'Filter & clean up',
        icon: IconArchive,
    },
    {
        href: '/unsubscribe',
        label: 'Unsubscribe',
        description: 'Cut the noise',
        icon: IconMailOff,
    },
    {
        href: '/sender-groups',
        label: 'Sender Groups',
        description: 'By who sent it',
        icon: IconUsers,
    },
] as const;

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${'BKMG'[i]}B`.replace(
        'BB',
        'B',
    );
}

export function DashboardOverview({ data }: { data: DashboardOverviewData }) {
    const { overview, topSenders, categoryBreakdown, storageByCategory } = data;

    return (
        <div className='flex flex-col gap-6 px-4 lg:px-6'>
            <div className='grid grid-cols-2 gap-4 @xl/main:grid-cols-4'>
                <Card>
                    <CardHeader className='gap-1'>
                        <CardDescription className='flex items-center gap-1.5'>
                            <IconMail className='size-3.5' />
                            Total emails
                        </CardDescription>
                        <CardTitle className='text-2xl font-semibold tabular-nums'>
                            {Number(overview.total_emails).toLocaleString(
                                'en-US',
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className='gap-1'>
                        <CardDescription className='flex items-center gap-1.5'>
                            <IconMail className='size-3.5' />
                            Unread
                        </CardDescription>
                        <CardTitle className='text-2xl font-semibold tabular-nums'>
                            {Number(overview.unread_count).toLocaleString(
                                'en-US',
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className='gap-1'>
                        <CardDescription className='flex items-center gap-1.5'>
                            <IconDatabase className='size-3.5' />
                            Storage used
                        </CardDescription>
                        <CardTitle className='text-2xl font-semibold tabular-nums'>
                            {formatBytes(Number(overview.total_size_bytes))}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className='gap-1'>
                        <CardDescription className='flex items-center gap-1.5'>
                            <IconUsers className='size-3.5' />
                            Unique senders
                        </CardDescription>
                        <CardTitle className='text-2xl font-semibold tabular-nums'>
                            {Number(overview.unique_senders).toLocaleString(
                                'en-US',
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {QUICK_ACTIONS.map(
                    ({ href, label, description, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className='hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors'
                        >
                            <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full'>
                                <Icon className='size-4' />
                            </div>
                            <div className='min-w-0'>
                                <p className='truncate text-sm font-medium'>
                                    {label}
                                </p>
                                <p className='text-muted-foreground truncate text-xs'>
                                    {description}
                                </p>
                            </div>
                        </Link>
                    ),
                )}
            </div>

            <MonthlyEmailChart storageByCategory={storageByCategory} />

            <div className='grid grid-cols-1 gap-4 @2xl/main:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>Categories</CardTitle>
                        <CardDescription>
                            Breakdown of your synced inbox
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-wrap gap-1.5'>
                        {categoryBreakdown
                            .slice()
                            .sort((a, b) => Number(b.count) - Number(a.count))
                            .map((c) => (
                                <Badge key={c.category} variant='outline'>
                                    {CATEGORY_LABELS[c.category] ?? c.category}:{' '}
                                    {Number(c.count).toLocaleString('en-US')}
                                </Badge>
                            ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top senders</CardTitle>
                        <CardDescription>
                            Who fills up your inbox most
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className='flex flex-col gap-2'>
                            {topSenders.slice(0, 5).map((sender) => (
                                <li
                                    key={sender.sender_email}
                                    className='flex items-center justify-between gap-2 text-sm'
                                >
                                    <span className='truncate'>
                                        {sender.sender_name ||
                                            sender.sender_email}
                                    </span>
                                    <Badge
                                        variant='secondary'
                                        className='shrink-0'
                                    >
                                        {sender.total_emails}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
