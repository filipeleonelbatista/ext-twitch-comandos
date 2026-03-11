/**
 * Twitch Extension – send chat message via EBS (backend uses viewer's helixToken for Helix).
 */
import { getChatSendUrl } from '@/lib/config';

export async function sendChatMessage(auth, message) {
  const token = auth.token;
  const helixToken = auth.helixToken;
  if (!token) return { ok: false, status: 400, error: 'Missing token' };
  if (!helixToken) return { ok: false, status: 400, error: 'Missing helixToken (enable Chat in Extensions)' };

  const url = getChatSendUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: message.trim().slice(0, 500),
      helixToken,
    }),
  });

  if (res.ok || res.status === 204) return { ok: true };
  const text = await res.text();
  let errMsg = text || res.statusText;
  try {
    const json = JSON.parse(text);
    if (json.error) errMsg = json.error;
  } catch (_) {}
  return { ok: false, status: res.status, error: errMsg };
}
