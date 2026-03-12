/**
 * EBS auth helpers: verify extension JWT and require broadcaster or moderator.
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getBroadcasterToken, setBroadcasterToken, deleteBroadcasterToken } from '@/lib/ebs-store';

const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || process.env.EXTENSION_CLIENT_ID || '';

function getExtensionSecret() {
  if (!EXTENSION_SECRET) return null;
  if (EXTENSION_SECRET.length === 32 && !EXTENSION_SECRET.includes(' ')) {
    return new TextEncoder().encode(EXTENSION_SECRET);
  }
  try {
    const binary =
      typeof Buffer !== 'undefined'
        ? Buffer.from(EXTENSION_SECRET, 'base64')
        : Uint8Array.from(atob(EXTENSION_SECRET), (c) => c.charCodeAt(0));
    if (binary.length > 0) {
      return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    }
  } catch (_) {}
  return new TextEncoder().encode(EXTENSION_SECRET);
}

/**
 * Verify extension frontend JWT. Returns payload or null.
 */
export async function verifyFrontendJwt(token) {
  const secret = getExtensionSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * From request, get Bearer token and verify. Returns { payload } or { error: NextResponse }.
 */
export async function getVerifiedPayload(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Missing or invalid Authorization' }, { status: 401 }) };
  }
  const token = auth.slice(7);
  const payload = await verifyFrontendJwt(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Invalid JWT' }, { status: 401 }) };
  }
  const channelId = payload.channel_id ?? payload.user_id;
  const userId = payload.user_id ?? payload.opaque_user_id;
  if (!channelId || !userId) {
    return {
      error: NextResponse.json(
        { error: 'Missing channel_id or user_id in JWT' },
        { status: 400 }
      ),
    };
  }
  return { payload, channelId: String(channelId), userId: String(userId) };
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

/**
 * Check if user_id is moderator of channel_id via Helix.
 */
async function isModerator(broadcasterId, userId, accessToken) {
  const url = `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${encodeURIComponent(broadcasterId)}&user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data?.data) && data.data.length > 0;
}

/**
 * Require that the request is from the broadcaster or a moderator of the channel.
 * Use for PATCH /api/channel-settings and GET /api/channel-settings/history.
 * Returns { channelId, userId } or { error: NextResponse }.
 */
export async function requireBroadcasterOrMod(request) {
  const result = await getVerifiedPayload(request);
  if (result.error) return result;
  const { channelId, userId } = result;

  if (userId === channelId) {
    return { channelId, userId };
  }

  const accessToken = await getValidBroadcasterToken(channelId);
  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: 'Broadcaster token not found. Authorize the extension first.' },
        { status: 403 }
      ),
    };
  }

  const mod = await isModerator(channelId, userId, accessToken);
  if (!mod) {
    return {
      error: NextResponse.json(
        { error: 'Apenas o broadcaster ou moderadores podem alterar as configurações.' },
        { status: 403 }
      ),
    };
  }

  return { channelId, userId };
}

/**
 * Fetch display login for a user via Helix (using broadcaster token).
 */
export async function getHelixUserLogin(broadcasterId, userId) {
  const accessToken = await getValidBroadcasterToken(broadcasterId);
  if (!accessToken) return '';
  const url = `https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) return '';
  const data = await res.json();
  const user = data?.data?.[0];
  return user?.login ?? '';
}
