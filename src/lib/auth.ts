import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import { db } from './db';
import { encrypt } from './encryption';
import { refreshGoogleAccessToken } from './google-oauth';

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
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken =
                    account.refresh_token ?? token.refreshToken;
                token.accessTokenExpires = account.expires_at! * 1000;

                // Parse id_token
                if (account.id_token) {
                    const data = JSON.parse(
                        Buffer.from(
                            account.id_token.split('.')[1],
                            'base64',
                        ).toString(),
                    );

                    token.sub = data.sub;
                    token.name = data.name;
                    token.email = data.email;
                    token.picture = data.picture;
                }

                await db.upsertUser({
                    email: token.email!,
                    name: token.name!,
                    gmailId: token.sub!,
                    image: token.picture,
                    accessToken: encrypt(token.accessToken!),
                    refreshToken: token.refreshToken
                        ? encrypt(token.refreshToken)
                        : undefined,
                });
            }

            // Token still valid
            if (Date.now() < token.accessTokenExpires!) {
                return token;
            }

            // Refresh if expired
            return await refreshAccessToken(token);
        },

        session({ session, token }) {
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

async function refreshAccessToken(token: JWT): Promise<JWT> {
    try {
        const refreshed = await refreshGoogleAccessToken(token.refreshToken!);

        await db.query(
            `UPDATE users SET access_token_encrypted = $1 WHERE email = $2`,
            [encrypt(refreshed.accessToken), token.email],
        );

        return {
            ...token,
            accessToken: refreshed.accessToken,
            accessTokenExpires: Date.now() + refreshed.expiresIn * 1000,
        };
    } catch (error) {
        return { ...token, error: 'RefreshAccessTokenError' };
    }
}
