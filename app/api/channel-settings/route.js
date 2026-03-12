import { NextResponse } from 'next/server';
import { getVerifiedPayload, requireBroadcasterOrMod, getHelixUserLogin } from '@/lib/auth-helpers';
import {
  getChannelSettings,
  updateChannelSettings,
  getDefaultSettings,
  trimChannelHistory,
} from '@/lib/firebase-admin';

/**
 * GET /api/channel-settings
 * Returns settings for the channel from JWT. Any viewer with valid JWT can read.
 */
export async function GET(request) {
  try {
    const result = await getVerifiedPayload(request);
    if (result.error) return result.error;
    const { channelId } = result;

    const settings = await getChannelSettings(channelId);
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[api/channel-settings GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

function sanitizePatch(body) {
  const patch = {};
  if (typeof body.rateLimitPerMinute === 'number' && body.rateLimitPerMinute >= 1 && body.rateLimitPerMinute <= 60) {
    patch.rateLimitPerMinute = body.rateLimitPerMinute;
  }
  if (Array.isArray(body.allowedCategories)) {
    patch.allowedCategories = body.allowedCategories.filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean);
  }
  if (Array.isArray(body.subsOnlyCategories)) {
    patch.subsOnlyCategories = body.subsOnlyCategories.filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean);
  }
  if (typeof body.ebsBaseUrl === 'string') {
    patch.ebsBaseUrl = body.ebsBaseUrl.trim();
  }
  return patch;
}

/**
 * PATCH /api/channel-settings
 * Update settings. Only broadcaster or moderators. Writes history.
 */
export async function PATCH(request) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId, userId } = authResult;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const patch = sanitizePatch(body);
    if (Object.keys(patch).length === 0) {
      const current = await getChannelSettings(channelId);
      return NextResponse.json(current);
    }

    const userLogin = await getHelixUserLogin(channelId, userId);
    const settings = await updateChannelSettings(channelId, patch, {
      userId,
      userLogin,
    });

    trimChannelHistory(channelId).catch(() => {});

    return NextResponse.json(settings);
  } catch (err) {
    console.error('[api/channel-settings PATCH]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
