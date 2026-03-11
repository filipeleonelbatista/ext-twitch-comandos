import { NextResponse } from 'next/server';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/callback`;
  const scope = 'channel:read:subscriptions';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(TWITCH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(authUrl);
}
