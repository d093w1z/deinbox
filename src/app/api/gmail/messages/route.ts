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

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    const cache = getCacheService();
    const cacheKey = `messages:${session.user.email}:${query}:${maxResults}`;

    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const gmail = await getGmailService();
    const messages = await gmail.getMessages(query, maxResults);

    await cache.set(cacheKey, messages, 1800);
    return NextResponse.json(messages);
}
