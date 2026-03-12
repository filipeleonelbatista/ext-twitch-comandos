import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { appendCommandLog } from '@/lib/firebase-admin';

const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
const EXTENSION_CLIENT_ID = process.env.EXTENSION_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '';
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || '0.0.1';

function getExtensionSecret() {
  if (!EXTENSION_SECRET) return null;
  if (EXTENSION_SECRET.length === 32 && !EXTENSION_SECRET.includes(' ')) {
    return new TextEncoder().encode(EXTENSION_SECRET);
  }
  try {
    const binary =
      typeof Buffer !== 'undefined'
        ? Buffer.from(EXTENSION_SECRET, 'base64')
        : Uint8Array.from(atob(EXTENSION_SECRET), (c) => c.charCodeAt(0));
    if (binary.length > 0) {
      return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    }
  } catch (_) {}
  return new TextEncoder().encode(EXTENSION_SECRET);
}

async function verifyFrontendJwt(token) {
  const secret = getExtensionSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization' }, { status: 401 });
    }
    const token = auth.slice(7);
    const payload = await verifyFrontendJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JWT' }, { status: 401 });
    }

    const channelId = payload.channel_id ?? payload.user_id;
    const userId = payload.user_id ?? payload.opaque_user_id;
    if (!channelId || !userId) {
      return NextResponse.json({ error: 'Missing channel or user in JWT' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const broadcasterDisplayName = typeof body.broadcasterDisplayName === 'string' ? body.broadcasterDisplayName.trim() : '';
    const senderDisplayName = typeof body.senderDisplayName === 'string' ? body.senderDisplayName.trim() : '';

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }
    if (!broadcasterDisplayName || !senderDisplayName) {
      return NextResponse.json(
        { error: 'Missing broadcasterDisplayName or senderDisplayName' },
        { status: 400 }
      );
    }

    const command = message.replace(/^!+/, '');
    const text = `${broadcasterDisplayName}: !${command} enviado por ${senderDisplayName}`.slice(0, 280);

    if (!EXTENSION_CLIENT_ID) {
      return NextResponse.json(
        { error: 'EBS not configured', detail: 'EXTENSION_CLIENT_ID (or TWITCH_CLIENT_ID) is not set' },
        { status: 500 }
      );
    }

    const secret = getExtensionSecret();
    if (!secret) {
      return NextResponse.json(
        { error: 'EBS not configured', detail: 'EXTENSION_SECRET is not set' },
        { status: 500 }
      );
    }

    const userIdNumeric = String(userId).replace(/^U/i, '');
    const exp = Math.floor(Date.now() / 1000) + 60;
    const externalJwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userIdNumeric)
      .setIssuedAt()
      .setExpirationTime(exp)
      .setClaim('role', 'external')
      .setClaim('channel_id', String(channelId))
      .setClaim('user_id', userIdNumeric)
      .sign(secret);

    const res = await fetch(
      `https://api.twitch.tv/helix/extensions/chat?broadcaster_id=${encodeURIComponent(String(channelId))}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${externalJwt}`,
          'Client-Id': EXTENSION_CLIENT_ID,
        },
        body: JSON.stringify({
          text,
          extension_id: EXTENSION_CLIENT_ID,
          extension_version: EXTENSION_VERSION,
        }),
      }
    );

    if (res.ok) {
      appendCommandLog(String(channelId), {
        userId: String(userId),
        userLogin: senderDisplayName,
        command,
      }).catch((err) => console.error('[api/chat/send] appendCommandLog:', err));
      return new NextResponse(null, { status: 204 });
    }
    const resText = await res.text();
    return NextResponse.json(
      { error: resText || res.statusText, twitch_status: res.status },
      { status: res.status >= 500 ? 502 : res.status }
    );
  } catch (err) {
    console.error('[api/chat/send]', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
