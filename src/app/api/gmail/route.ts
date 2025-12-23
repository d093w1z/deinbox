import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import type { Email } from '@/types/EmailSchema';
import { EmailSchema } from '@/types/EmailSchema';
import { GmailStatsResponseSchema } from '@/types/GmailStatsResponse';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleApiError } from '../_utils/handle-api-error';

function computeStatsFromEmails(emails: Email[]) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const categoryCounts: Record<string, number> = {};
    const senderFrequency: Record<string, number> = {};
    let attachmentSize = 0;
    let unreadCount = 0;
    let oldEmailsCount = 0;

    for (const email of emails) {
        categoryCounts[email.category] =
            (categoryCounts[email.category] || 0) + 1;

        const sender = email.from.match(/<(.+)>/)?.[1] ?? email.from;
        senderFrequency[sender] = (senderFrequency[sender] || 0) + 1;

        if (email.hasAttachment) attachmentSize += email.size;
        if (email.isUnread) unreadCount++;
        if (new Date(email.date) < oneYearAgo) oldEmailsCount++;
    }

    return {
        totalEmails: emails.length,
        unreadCount,
        categoryCounts,
        senderFrequency,
        attachmentSize,
        oldEmailsCount,
    };
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const gmailService = await getGmailService();
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query') || 'newer_than:7d';

        const [rawEmails, profile] = await Promise.all([
            gmailService.getMessages(query),
            gmailService.getProfile(),
        ]);

        const emails = EmailSchema.array().parse(rawEmails);
        const stats = computeStatsFromEmails(emails);

        const response = GmailStatsResponseSchema.parse({
            profile,
            emails,
            recentEmailCount: emails.length,
            stats,
            unsubscribeList: [],
        });

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error in Gmail API route:', error);
        return handleApiError(error);
    }
}
