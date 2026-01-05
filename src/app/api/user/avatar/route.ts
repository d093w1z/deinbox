import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import type { User } from '@/types/User';

export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userResult = await db.query<User>(
            'SELECT id, image FROM users WHERE email = $1',
            [session.user.email],
        );

        if (!userResult.rows[0]) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 },
            );
        }

        const user: User = userResult.rows[0];

        if (!user.image) {
            return NextResponse.json(
                { error: 'User avatar not found' },
                { status: 404 },
            );
        }

        return NextResponse.json({ image: user.image });
    } catch (error) {
        console.error('Failed to fetch avatar:', error);
        return NextResponse.json(
            { error: 'Failed to fetch avatar' },
            { status: 500 },
        );
    }
}
