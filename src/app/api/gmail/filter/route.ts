import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
import { EmailSchema } from '@/types/EmailSchema';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleApiError } from '../../_utils/handle-api-error';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(req.url);

        const filter: {
            olderThan?: Date;
            sender?: string;
            hasAttachment?: boolean;
            category?: string;
            isUnread?: boolean;
        } = {};

        const olderThan = searchParams.get('olderThan');
        if (olderThan) filter.olderThan = new Date(olderThan);

        const sender = searchParams.get('sender');
        if (sender) filter.sender = sender;

        if (searchParams.get('hasAttachment') === 'true')
            filter.hasAttachment = true;

        const category = searchParams.get('category');
        if (category) filter.category = category;

        if (searchParams.get('isUnread') === 'true') filter.isUnread = true;

        const cacheKey = `filter:${session.user.email}:${JSON.stringify(filter)}`;
        const cache = getCacheService();
        const cached = await cache.get(cacheKey);
        if (cached) return NextResponse.json(cached);

        const gmail = await getGmailService();
        const rawMessages = await gmail.getMessagesByFilter(filter);
        const emails = EmailSchema.array().parse(rawMessages);

        const response = { emails, count: emails.length };
        await cache.set(cacheKey, response, 300);

        return NextResponse.json(response);
    } catch (error) {
        return handleApiError(error);
    }
}
