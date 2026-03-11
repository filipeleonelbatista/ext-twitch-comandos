import { NextResponse } from 'next/server';
import { setBroadcasterToken } from '@/lib/ebs-store';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  if (!code) {
    return new NextResponse('Missing code', { status: 400 });
  }

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return new NextResponse('Token exchange failed: ' + t, { status: 400 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const expiresAt = Date.now() + (tokenData.expires_in || 0) * 1000;

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });

  if (!userRes.ok) {
    return new NextResponse('Failed to get user', { status: 400 });
  }

  const userData = await userRes.json();
  const broadcasterId = userData.data?.[0]?.id;
  if (!broadcasterId) {
    return new NextResponse('No user in response', { status: 400 });
  }

  setBroadcasterToken(broadcasterId, {
    accessToken,
    refreshToken,
    expiresAt,
  });

  const redirectTo = state || 'https://dev.twitch.tv/console/extensions';
  return NextResponse.redirect(redirectTo);
}
