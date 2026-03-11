import { NextResponse } from 'next/server';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

/** Build redirect_uri without trailing slash so it matches Twitch Console exactly. */
function getRedirectUri(request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || '').replace(/\/$/, '');
  return `${base}/api/auth/callback`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || '';
  const type = searchParams.get('type') || ''; // 'viewer' | broadcaster
  const redirectUri = getRedirectUri(request);

  const isViewer = type === 'viewer';
  const scope = isViewer ? 'user:write:chat' : 'channel:read:subscriptions user:write:chat';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(TWITCH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(authUrl);
}
