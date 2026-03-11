/**
 * In-memory store for broadcaster OAuth tokens (EBS).
 * Only imported by API routes (server). For production with multiple instances,
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
