import { NextResponse } from 'next/server';
import { requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { getChannelSettingsHistory } from '@/lib/firebase-admin';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/channel-settings/history
 * Returns recent settings change history. Only broadcaster or moderators.
 */
export async function GET(request) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId } = authResult;

    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit'), 10);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const history = await getChannelSettingsHistory(channelId, limit);
    return NextResponse.json(history);
  } catch (err) {
    console.error('[api/channel-settings/history GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
