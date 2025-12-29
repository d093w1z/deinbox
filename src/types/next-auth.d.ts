import type { AdapterUser } from 'next-auth/adapters';

declare module 'next-auth' {
    interface Session {
        accessToken?: string;
        user: AdapterUser;
        expires: number;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        accessTokenExpires?: number;
        id?: string;
    }
}
