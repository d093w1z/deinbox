import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: [
                        'openid',
                        'email',
                        'profile',
                        'https://www.googleapis.com/auth/gmail.readonly',
                        'https://www.googleapis.com/auth/gmail.modify',
                        'https://www.googleapis.com/auth/gmail.labels',
                    ].join(' '),
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),
    ],

    callbacks: {
        async jwt({ token, account }) {
            // First login
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at;

                // ⭐ Pull Google profile DIRECTLY from id_token
                if (account.id_token) {
                    const data = JSON.parse(
                        Buffer.from(account.id_token.split('.')[1], 'base64').toString(),
                    );

                    token.name = data.name;
                    token.email = data.email;
                    token.picture = data.picture;
                }
            }

            // token not expired
            if (Date.now() < (token.accessTokenExpires as number) * 1000) {
                return token;
            }

            // otherwise refresh
            return await refreshAccessToken(token);
        },

        async session({ session, token }) {
            console.log('Token in session callback:', token);

            session.accessToken = token.accessToken;
            session.expires = token.accessTokenExpires!;

            session.user = {
                id: token.sub!,
                name: token.name!,
                email: token.email!,
                image: token.picture ?? null,
                emailVerified: null,
            };

            return session;
        },
    },

    pages: {
        signIn: '/login',
        error: '/auth/error',
    },
};

async function refreshAccessToken(token: JWT) {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken!,
            }),
        });

        const refreshed = await response.json();
        if (!response.ok) throw refreshed;

        return {
            ...token,
            accessToken: refreshed.access_token,
            accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
            refreshToken: refreshed.refresh_token ?? token.refreshToken,
        };
    } catch (err) {
        return { ...token, error: 'RefreshAccessTokenError' };
    }
}
