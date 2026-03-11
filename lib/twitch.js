/**
 * Twitch Extension Helper – send chat message (client).
 */
const HELIX_BASE = 'https://api.twitch.tv/helix';

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
  const channelId = auth.channelId || auth.channel_id;
  const userId = auth.userId || auth.user_id;
  if (!channelId || !userId) return { ok: false, status: 400, error: 'Missing channel or user' };
  return sendExtensionChatMessage(
    auth.token || auth.helixToken,
    clientId,
    channelId,
    userId,
    message
  );
}
