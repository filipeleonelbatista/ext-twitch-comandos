import { NextResponse } from 'next/server';
import { requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { getCommandLogs } from '@/lib/firebase-admin';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/channel-settings/command-logs
 * Returns recent command send log (who sent, when, channel). Broadcaster or mod only.
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
    const logs = await getCommandLogs(channelId, limit);
    return NextResponse.json(logs);
  } catch (err) {
    console.error('[api/channel-settings/command-logs GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
