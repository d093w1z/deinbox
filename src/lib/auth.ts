// lib/auth.ts
import {NextAuthOptions} from 'next-auth'
import {JWT} from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: {
      params: {
        scope: [
          'openid', 'email', 'profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.labels'
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  })],
  callbacks: {
    async jwt({token, account, profile}) {
      if (account && profile) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
        token.name = profile.name
        token.email = profile.email;
        token.picture = profile.image;
      }

      if (Date.now() < (token.accessTokenExpires as number) * 1000) {
        return token
      }

      return await refreshAccessToken(token)
    },
    async session({session, token}) {
      session.accessToken = token.accessToken
      session.expires = token.accessTokenExpires!;

      session.user = {
        id: token.id!,
        emailVerified: null,
        name: token.name as string,
        email: token.email as string,
        image: token.picture as string
      }

      return session
    }
  },
  pages: {signIn: '/login', error: '/auth/error'}
}

async function refreshAccessToken(token: JWT) {
  try {
    const url = 'https://oauth2.googleapis.com/token'
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string
      })
    })

    const refreshedTokens = await response.json()
    if (!response.ok) throw refreshedTokens

    return {
      ...token, accessToken: refreshedTokens.access_token,
          accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
          refreshToken: refreshedTokens.refresh_token ?? token.refreshToken
    }
  } catch (error) {
    return {
      ...token, error: 'RefreshAccessTokenError: ' + error
    }
  }
}
