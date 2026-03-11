/**
 * Twitch Extension – send chat message via EBS (backend uses viewer OAuth token).
 */
import { getChatSendUrl } from '@/lib/config';

export async function sendChatMessage(auth, message) {
  const token = auth.token;
  if (!token) return { ok: false, status: 400, error: 'Missing token' };

  const url = getChatSendUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: message.trim().slice(0, 500) }),
  });

  if (res.ok || res.status === 204) return { ok: true };
  const text = await res.text();
  let errMsg = text || res.statusText;
  let needAuthorization = false;
  let authUrl = null;
  try {
    const json = JSON.parse(text);
    if (json.error) errMsg = json.error;
    if (json.need_authorization) needAuthorization = true;
    if (json.auth_url) authUrl = json.auth_url;
  } catch (_) {}
  return { ok: false, status: res.status, error: errMsg, needAuthorization, authUrl };
}
