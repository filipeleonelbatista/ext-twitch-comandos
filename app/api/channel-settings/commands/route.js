import { NextResponse } from 'next/server';
import { getVerifiedPayload, requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { getCustomCommands, addCustomCommand } from '@/lib/firebase-admin';

/**
 * GET /api/channel-settings/commands
 * Returns custom commands for the channel. Any valid JWT can read (panel + config).
 */
export async function GET(request) {
  try {
    const result = await getVerifiedPayload(request);
    if (result.error) return result.error;
    const { channelId } = result;
    const commands = await getCustomCommands(channelId);
    return NextResponse.json(commands);
  } catch (err) {
    console.error('[api/channel-settings/commands GET]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/channel-settings/commands
 * Add a custom command. Body: { command, category?, subsOnly? }. Broadcaster or mod only.
 */
export async function POST(request) {
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
    const command = typeof body.command === 'string' ? body.command.trim() : '';
    if (!command) {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }
    const category = typeof body.category === 'string' ? body.category.trim() || 'Geral' : 'Geral';
    const subsOnly = !!body.subsOnly;
    const created = await addCustomCommand(channelId, { command, category, subsOnly });
    return NextResponse.json(created);
  } catch (err) {
    console.error('[api/channel-settings/commands POST]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
