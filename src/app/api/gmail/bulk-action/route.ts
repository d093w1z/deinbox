import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, messageIds } = await req.json();

    if (!action || !Array.isArray(messageIds)) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const gmail = await getGmailService();
    if (action === 'delete') await gmail.deleteMessages(messageIds);
    else if (action === 'archive') await gmail.archiveMessages(messageIds);
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const cache = getCacheService();
    await cache.invalidateUserCache(session.user.email);

    return NextResponse.json({ success: true, processed: messageIds.length });
}
