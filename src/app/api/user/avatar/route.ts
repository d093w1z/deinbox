import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get user
        const userResult = await db.query(
            'SELECT id, image FROM users WHERE email = $1',
            [session.user.email],
        );

        if (!userResult.rows[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }

        const user = userResult.rows[0];

        // Check if sync already in progress
        if (user.image) {
            return NextResponse.json(
                { error: 'User avatar not found' },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            image: user.image,
            message: 'Sync started in background',
        });
    } catch (error) {
        console.error('Failed to start sync:', error);
        return NextResponse.json(
            { error: 'Failed to start sync' },
            { status: 500 },
        );
    }
}
