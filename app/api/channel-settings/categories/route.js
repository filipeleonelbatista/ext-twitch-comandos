import { NextResponse } from 'next/server';
import { getVerifiedPayload, requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { getCustomCategories, setCustomCategories } from '@/lib/firebase-admin';

/**
 * GET /api/channel-settings/categories
 * Returns custom category names. Any valid JWT can read.
 */
export async function GET(request) {
  try {
    const result = await getVerifiedPayload(request);
    if (result.error) return result.error;
    const { channelId } = result;
    const categories = await getCustomCategories(channelId);
    return NextResponse.json(categories);
  } catch (err) {
    console.error('[api/channel-settings/categories GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/channel-settings/categories
 * Set custom categories (replace list). Body: { categories: string[] }. Broadcaster or mod only.
 */
export async function PATCH(request) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId } = authResult;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const list = Array.isArray(body.categories)
      ? body.categories.map((c) => String(c).trim()).filter(Boolean)
      : [];
    const categories = await setCustomCategories(channelId, list);
    return NextResponse.json(categories);
  } catch (err) {
    console.error('[api/channel-settings/categories PATCH]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
