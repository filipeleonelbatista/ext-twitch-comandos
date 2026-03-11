/**
 * Runtime config for the panel (client).
 */
const DEFAULT_SHEETS = {
  followers:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6oLOtDazBXQgSf2ldgUIt3xqnr6erVSdg72LCL7tImcYVFbbQOXZVt2FqzKNjg_8u3YZLpU8onSCt/pub?output=csv&gid=1478494058',
  subscribers:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6oLOtDazBXQgSf2ldgUIt3xqnr6erVSdg72LCL7tImcYVFbbQOXZVt2FqzKNjg_8u3YZLpU8onSCt/pub?output=csv&gid=966441261',
};

const POLLING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

export function getSheetsConfig() {
  return { ...DEFAULT_SHEETS };
}

export function getPollingIntervalMs() {
  return POLLING_INTERVAL_MS;
}

/** API base: same origin uses /api (Next.js API routes); else env or Twitch config */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.Twitch?.ext?.configuration?.broadcaster?.content) {
    try {
      const c = JSON.parse(window.Twitch.ext.configuration.broadcaster.content);
      if (c.ebsBaseUrl) return c.ebsBaseUrl.replace(/\/$/, '');
    } catch (_) {}
  }
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_EBS_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    return ''; // same origin -> fetch /api/sub-check
  }
  return '';
}

/** URL for sub-check: /api/sub-check when same origin, else {apiBase}/api/sub-check */
export function getSubCheckUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/sub-check` : '/api/sub-check';
}

/** URL for send chat (EBS proxy): /api/chat/send when same origin, else {apiBase}/api/chat/send */
export function getChatSendUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/chat/send` : '/api/chat/send';
}
