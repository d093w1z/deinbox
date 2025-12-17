import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cache = getCacheService();
    const cacheKey = `unsubscribe:${session.user.email}`;

    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const gmail = await getGmailService();
    const info = await gmail.getUnsubscribeInfo();

    await cache.set(cacheKey, info, 7200);
    return NextResponse.json(info);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url) {
        return NextResponse.json(
            { error: 'Unsubscribe URL required' },
            { status: 400 },
        );
    }

    const result = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Gmail Inbox Cleaner' },
    });

    if (result.ok) {
        const cache = getCacheService();
        await cache.invalidateUserCache(session.user.email);
        return NextResponse.json({ success: true });
    } else {
        return NextResponse.json(
            { error: 'Failed to unsubscribe' },
            { status: 400 },
        );
    }
}
