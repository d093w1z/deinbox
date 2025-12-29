// Standalone Google OAuth token refresh, usable outside the NextAuth
// request/session lifecycle (e.g. from the background sync worker, which
// never goes through the `jwt` callback in auth.ts).
export async function refreshGoogleAccessToken(
    refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    const data: Record<string, unknown> = await response.json();

    if (!response.ok) {
        throw new Error(
            `Failed to refresh Google access token: ${JSON.stringify(data)}`,
        );
    }

    return {
        accessToken: data.access_token as string,
        expiresIn: data.expires_in as number,
    };
}
