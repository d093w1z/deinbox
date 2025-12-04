import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
    // const session  = await getServerSession();
    // console.log(session);

    return;
    return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
