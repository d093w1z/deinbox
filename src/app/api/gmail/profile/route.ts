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
    const cacheKey = `profile:${session.user.email}`;

    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const gmail = await getGmailService();
    const profile = await gmail.getProfile();

    await cache.set(cacheKey, profile, 3600);

    return NextResponse.json(profile);
}
