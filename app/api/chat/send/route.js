import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
const EXTENSION_CLIENT_ID = process.env.EXTENSION_CLIENT_ID || process.env.TWITCH_CLIENT_ID || '';

function getExtensionSecret() {
  if (!EXTENSION_SECRET) return null;
  if (EXTENSION_SECRET.length === 32 && !EXTENSION_SECRET.includes(' ')) {
    return new TextEncoder().encode(EXTENSION_SECRET);
  }
  if (Buffer.from(EXTENSION_SECRET, 'base64').length > 0) {
    return new Uint8Array(Buffer.from(EXTENSION_SECRET, 'base64'));
  }
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

/** EBS JWT for Send Extension Chat Message: Twitch expects this signed with Extension Secret. */
async function signEbsChatJwt(broadcasterId) {
  const secret = getExtensionSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 60;
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(exp)
    .setClaim('user_id', String(broadcasterId))
    .setClaim('role', 'broadcaster')
    .sign(secret);
  return jwt;
}

export async function POST(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization' }, { status: 401 });
  }
  const token = auth.slice(7);
  const payload = await verifyFrontendJwt(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid JWT' }, { status: 401 });
  }

  const broadcasterId = payload.channel_id ?? payload.user_id;
  const senderId = payload.user_id ?? payload.opaque_user_id;
  if (!broadcasterId || !senderId) {
    return NextResponse.json({ error: 'Missing channel or user in JWT' }, { status: 400 });
  }
  const senderIdNumeric = String(payload.user_id ?? senderId);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  if (!message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const ebsJwt = await signEbsChatJwt(broadcasterId);
  if (!ebsJwt) {
    return NextResponse.json({ error: 'EBS JWT not configured' }, { status: 500 });
  }

  const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ebsJwt}`,
      'Client-Id': EXTENSION_CLIENT_ID,
    },
    body: JSON.stringify({
      broadcaster_id: String(broadcasterId),
      sender_id: senderIdNumeric,
      message,
    }),
  });

  if (res.ok) {
    return new NextResponse(null, { status: 204 });
  }
  const text = await res.text();
  return NextResponse.json(
    { error: text || res.statusText },
    { status: res.status }
  );
}
