import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PreviewRequestSchema = z.object({
    messageIds: z.array(z.string()).min(1).max(5000),
});

const PREVIEW_TTL_SECONDS = 3600;

// Stores a list of Gmail message IDs server-side (Redis) behind a short
// opaque token, so callers that want to filter /emails down to a specific
// set of messages (e.g. "preview this suggestion's matches") don't have to
// cram potentially thousands of IDs into a URL, which breaks well before
// that on browser/proxy URL-length limits (~2000 chars).
export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body: unknown = await req.json();
        const { messageIds } = PreviewRequestSchema.parse(body);

        const userResult = await db.query<{ id: string }>(
            'SELECT id FROM users WHERE email = $1',
            [session.user.email],
        );
        if (!userResult.rows[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }

        const token = randomUUID();
        await getCacheService().set(
            `email-preview:${token}`,
            { userId: userResult.rows[0].id, messageIds },
            PREVIEW_TTL_SECONDS,
        );

        return NextResponse.json({ token });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request' },
                { status: 400 },
            );
        }
        console.error('Failed to create email preview:', error);
        return NextResponse.json(
            { error: 'Failed to create preview' },
            { status: 500 },
        );
    }
}
