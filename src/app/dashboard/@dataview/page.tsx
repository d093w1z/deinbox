import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { EmailTable } from '@/components/email-table';
import { NoSyncedData } from '@/components/no-synced-data';
import { EmailSchema } from '@/types/EmailSchema';
import { z } from 'zod';

const MessagesResponseSchema = z.object({ emails: z.array(EmailSchema) });

export default async function DataViewSlot() {
    const session = await getServerSession();
    if (!session) {
        redirect('/login');
    }

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

    const params = new URLSearchParams({
        days: '90',
        direction: 'newer',
        category: 'all',
        hasAttachment: 'false',
        unreadOnly: 'false',
        limit: '200',
    });
    const apiUrl = new URL(
        `/api/analytics/messages?${params}`,
        process.env.NEXTAUTH_URL,
    );

    const res = await fetch(apiUrl, {
        cache: 'no-store',
        headers: { Cookie: cookieHeader },
    });

    if (!res.ok) {
        return (
            <div className='px-4 lg:px-6'>
                <p className='text-destructive text-sm'>
                    Failed to load recent emails.
                </p>
            </div>
        );
    }

    const json = (await res.json()) as unknown;
    const data = MessagesResponseSchema.parse(json);

    if (data.emails.length === 0) {
        return (
            <NoSyncedData description='Recent emails are built from your synced inbox. Run a sync to see them here.' />
        );
    }

    return (
        <div className='flex flex-col gap-2'>
            <h2 className='text-muted-foreground px-4 text-sm font-medium lg:px-6'>
                Recent emails (last 90 days)
            </h2>
            <EmailTable data={data.emails} />
        </div>
    );
}
