/**
 * In-memory store for broadcaster and viewer OAuth tokens (EBS).
 * Only imported by API routes (server). For production with multiple instances,
 * replace with Redis/Vercel KV or similar.
 */
const broadcasterTokens = new Map();
const viewerTokens = new Map();

export function getBroadcasterToken(broadcasterId) {
  return broadcasterTokens.get(broadcasterId) ?? null;
}

export function setBroadcasterToken(broadcasterId, data) {
  broadcasterTokens.set(broadcasterId, data);
}

export function deleteBroadcasterToken(broadcasterId) {
  broadcasterTokens.delete(broadcasterId);
}

export function getViewerToken(userId) {
  return viewerTokens.get(userId) ?? null;
}

export function setViewerToken(userId, data) {
  viewerTokens.set(userId, data);
}

export function deleteViewerToken(userId) {
  viewerTokens.delete(userId);
}
