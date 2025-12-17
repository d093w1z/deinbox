import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(_request: NextRequest) {
    return;
    // return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
