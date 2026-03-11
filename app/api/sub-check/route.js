import { NextResponse } from 'next/server';
import { jwtVerify, decodeJwt } from 'jose';
import { getBroadcasterToken, setBroadcasterToken, deleteBroadcasterToken } from '@/lib/ebs-store';

const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

async function verifyTwitchJwt(token) {
  if (!EXTENSION_SECRET) return decodeJwt(token);
  const secret =
    EXTENSION_SECRET.length === 32 && !EXTENSION_SECRET.includes(' ')
      ? new TextEncoder().encode(EXTENSION_SECRET)
      : Buffer.from(EXTENSION_SECRET, 'base64').length > 0
        ? new Uint8Array(Buffer.from(EXTENSION_SECRET, 'base64'))
        : new TextEncoder().encode(EXTENSION_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

async function refreshTwitchToken(refreshToken) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const expiresAt = Date.now() + (data.expires_in || 0) * 1000;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
  };
}

async function getValidBroadcasterToken(broadcasterId) {
  const stored = getBroadcasterToken(broadcasterId);
  if (!stored) return null;
  if (stored.expiresAt && Date.now() >= stored.expiresAt - 60000) {
    const refreshed = await refreshTwitchToken(stored.refreshToken);
    if (refreshed) {
      setBroadcasterToken(broadcasterId, refreshed);
      return refreshed.accessToken;
    }
    deleteBroadcasterToken(broadcasterId);
    return null;
  }
  return stored.accessToken;
}

async function checkUserSubscription(broadcasterId, userId, accessToken) {
  const url = `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${broadcasterId}&user_id=${userId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (res.status === 404) return false;
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data?.data) && data.data.length > 0;
}

export async function POST(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization' }, { status: 401 });
  }
  const token = auth.slice(7);
  let payload;
  try {
    payload = await verifyTwitchJwt(token);
  } catch {
    return NextResponse.json({ error: 'Invalid JWT' }, { status: 401 });
  }
  const userId = payload.user_id ?? payload.opaque_user_id;
  const broadcasterId = payload.channel_id;
  if (!userId || !broadcasterId) {
    return NextResponse.json(
      { error: 'Missing user_id or channel_id in JWT' },
      { status: 400 }
    );
  }
  const accessToken = await getValidBroadcasterToken(broadcasterId);
  if (!accessToken) {
    return NextResponse.json({ isSubscriber: false });
  }
  const isSubscriber = await checkUserSubscription(broadcasterId, userId, accessToken);
  return NextResponse.json({ isSubscriber });
}
