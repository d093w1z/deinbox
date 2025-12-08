import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
import { Email, EmailSchema } from '@/types/EmailSchema';
import { z } from 'zod';
import { GmailStatsResponseSchema } from '@/types/GmailStatsResponse';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const gmailService = await getGmailService();

        const { searchParams } = new URL(req.url);

        const query = searchParams.get('query') || 'newer_than:7d';

        let emails: Email[] = [];

        emails = EmailSchema.array().parse(await gmailService.getMessages(query));
        const profile = await gmailService.getProfile();
        const stats = await gmailService.getEmailStats();
        const unsubscribeList = await gmailService.getUnsubscribeInfo();

        console.log('Gmail API route fetched emails count:', emails.length);

        let response = GmailStatsResponseSchema.parse({
            profile,
            emails,
            recentEmailCount: emails.length,
            stats,
            unsubscribeList,
        }); // Validate before

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error in Gmail API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Gmail data' },
            { status: 500 },
        );
    }
}
