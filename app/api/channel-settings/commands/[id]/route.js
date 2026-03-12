import { NextResponse } from 'next/server';
import { requireBroadcasterOrMod } from '@/lib/auth-helpers';
import { updateCustomCommand, deleteCustomCommand } from '@/lib/firebase-admin';

/**
 * PATCH /api/channel-settings/commands/[id]
 * Update a custom command. Body: { command?, category?, subsOnly? }. Broadcaster or mod only.
 */
export async function PATCH(request, { params }) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId } = authResult;
    const p = typeof params?.then === 'function' ? await params : params;
    const id = p?.id;
    if (!id) {
      return NextResponse.json({ error: 'Command id required' }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const patch = {};
    if (typeof body.command === 'string') patch.command = body.command.trim();
    if (body.category !== undefined) patch.category = String(body.category).trim() || 'Geral';
    if (body.subsOnly !== undefined) patch.subsOnly = !!body.subsOnly;
    const updated = await updateCustomCommand(channelId, id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/channel-settings/commands PATCH]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/channel-settings/commands/[id]
 * Delete a custom command. Broadcaster or mod only.
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await requireBroadcasterOrMod(request);
    if (authResult.error) return authResult.error;
    const { channelId } = authResult;
    const p = typeof params?.then === 'function' ? await params : params;
    const id = p?.id;
    if (!id) {
      return NextResponse.json({ error: 'Command id required' }, { status: 400 });
    }
    await deleteCustomCommand(channelId, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[api/channel-settings/commands DELETE]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
