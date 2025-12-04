import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
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

        const cache = getCacheService();
        const cacheKey = `messages:${session.user.email}:${query}`;

        const cached = await cache.get(cacheKey);
        let emails = [];

        // if (cached) emails = JSON.parse(cached);

        const profile = await gmailService.getProfile();
        emails = await gmailService.getMessages(query);
        const stats = await gmailService.getEmailStats();
        const unsubscribeList = await gmailService.getUnsubscribeInfo();

        await cache.set(cacheKey, emails, 1800);

        return NextResponse.json({
            profile,
            recentEmailCount: emails.length,
            stats,
            unsubscribeList,
        });
    } catch (error) {
        console.error('Error in Gmail API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Gmail data' },
            { status: 500 },
        );
    }
}
