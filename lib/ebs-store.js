/**
 * In-memory store for broadcaster OAuth tokens (EBS).
 * Used for sub-check (Check User Subscription). For production with multiple instances,
 * replace with Redis/Vercel KV or similar.
 */
const broadcasterTokens = new Map();

export function getBroadcasterToken(broadcasterId) {
  return broadcasterTokens.get(broadcasterId) ?? null;
}

export function setBroadcasterToken(broadcasterId, data) {
  broadcasterTokens.set(broadcasterId, data);
}

export function deleteBroadcasterToken(broadcasterId) {
  broadcasterTokens.delete(broadcasterId);
}
