import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getBroadcasterToken, setBroadcasterToken, deleteBroadcasterToken } from '@/lib/ebs-store';

const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
const EXTENSION_CLIENT_ID = process.env.EXTENSION_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '';

function getExtensionSecret() {
  if (!EXTENSION_SECRET) return null;
  if (EXTENSION_SECRET.length === 32 && !EXTENSION_SECRET.includes(' ')) {
    return new TextEncoder().encode(EXTENSION_SECRET);
  }
  try {
    const binary = typeof Buffer !== 'undefined'
      ? Buffer.from(EXTENSION_SECRET, 'base64')
      : Uint8Array.from(atob(EXTENSION_SECRET), (c) => c.charCodeAt(0));
    if (binary.length > 0) {
      return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    }
  } catch (_) {}
  return new TextEncoder().encode(EXTENSION_SECRET);
}

async function verifyFrontendJwt(token) {
  const secret = getExtensionSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

async function refreshTwitchToken(refreshToken) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID || '',
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

export async function POST(request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization' }, { status: 401 });
    }
    const token = auth.slice(7);
    const payload = await verifyFrontendJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JWT' }, { status: 401 });
    }

    const broadcasterId = payload.channel_id ?? payload.user_id;
    const senderId = payload.user_id ?? payload.opaque_user_id;
    if (!broadcasterId || !senderId) {
      return NextResponse.json({ error: 'Missing channel or user in JWT' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const accessToken = await getValidBroadcasterToken(broadcasterId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Broadcaster not linked. Open the extension config and complete OAuth (link account).' },
        { status: 403 }
      );
    }

    if (!EXTENSION_CLIENT_ID) {
      return NextResponse.json(
        { error: 'EBS not configured', detail: 'EXTENSION_CLIENT_ID (or TWITCH_CLIENT_ID) is not set' },
        { status: 500 }
      );
    }

    const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': EXTENSION_CLIENT_ID,
      },
      body: JSON.stringify({
        broadcaster_id: String(broadcasterId),
        sender_id: String(broadcasterId),
        message,
      }),
    });

    if (res.ok) {
      return new NextResponse(null, { status: 204 });
    }
    const text = await res.text();
    return NextResponse.json(
      { error: text || res.statusText, twitch_status: res.status },
      { status: res.status >= 500 ? 502 : res.status }
    );
  } catch (err) {
    console.error('[api/chat/send]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
