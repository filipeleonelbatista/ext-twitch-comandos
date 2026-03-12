/**
 * Twitch Extension – send chat message via EBS (Send Extension Chat Message).
 */
import { getChatSendUrl } from '@/lib/config';

export async function sendChatMessage(auth, message, broadcasterDisplayName, senderDisplayName) {
  const token = auth?.token;
  if (!token) return { ok: false, status: 400, error: 'Missing token' };

  const url = getChatSendUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
      broadcasterDisplayName: typeof broadcasterDisplayName === 'string' ? broadcasterDisplayName.trim() : '',
      senderDisplayName: typeof senderDisplayName === 'string' ? senderDisplayName.trim() : '',
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
