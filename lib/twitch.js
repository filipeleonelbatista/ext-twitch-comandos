/**
 * Twitch Extension Helper – send chat message (client).
 */
const HELIX_BASE = 'https://api.twitch.tv/helix';

/** Decode JWT payload without verification (client-side, only to read user_id/channel_id). */
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export async function sendExtensionChatMessage(token, clientId, broadcasterId, senderId, message) {
  const res = await fetch(`${HELIX_BASE}/chat/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Extension ${token}`,
      'Client-Id': clientId,
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: senderId,
      message: message.trim().slice(0, 500),
    }),
  });
  if (res.ok) return { ok: true };
  const text = await res.text();
  return { ok: false, status: res.status, error: text || res.statusText };
}

export async function sendChatMessage(auth, message) {
  const clientId = auth.clientId || process.env.NEXT_PUBLIC_EXTENSION_CLIENT_ID || '';
  const token = auth.token || auth.helixToken;
  if (!token) return { ok: false, status: 400, error: 'Missing token' };

  const payload = decodeJwtPayload(token);
  const channelId = payload?.channel_id ?? auth.channelId ?? auth.channel_id;
  const userId = payload?.user_id ?? auth.userId ?? auth.user_id;

  if (!channelId || !userId) return { ok: false, status: 400, error: 'Missing channel or user' };

  const broadcasterId = String(channelId);
  const senderId = String(userId);

  return sendExtensionChatMessage(token, clientId, broadcasterId, senderId, message);
}
