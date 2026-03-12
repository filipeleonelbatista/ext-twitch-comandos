import { NextResponse } from 'next/server';
import { requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { getCommandMetrics } from '@/lib/firebase-admin';

/**
 * GET /api/channel-settings/metrics
 * Returns usage metrics: top users by command count, top commands by use. Broadcaster or mod only.
 */
export async function GET(request) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId } = authResult;
    const metrics = await getCommandMetrics(channelId);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('[api/channel-settings/metrics GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
