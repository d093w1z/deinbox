import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { DashboardOverview } from '@/components/dashboard-overview';
import type { DashboardOverviewData } from '@/components/dashboard-overview';
import { NoSyncedData } from '@/components/no-synced-data';

export default async function AnalyticsSlot() {
    const session = await getServerSession();
    if (!session) {
        redirect('/login');
    }

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

    const apiUrl = new URL('/api/analytics/overview', process.env.NEXTAUTH_URL);

    const res = await fetch(apiUrl, {
        cache: 'no-store',
        headers: { Cookie: cookieHeader },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch dashboard analytics');
    }

    const data = (await res.json()) as DashboardOverviewData;

    if (Number(data.overview?.total_emails ?? 0) === 0) {
        return (
            <NoSyncedData description='Your dashboard is built from your synced inbox. Run a sync to see analytics here.' />
        );
    }

    return <DashboardOverview data={data} />;
}
