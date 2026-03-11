import { NextResponse } from 'next/server';

/**
 * GET /api/test-keys
 *
 * Chama a API da Twitch para verificar se as chaves estão funcionando.
 * Em produção só responde se ?key=TEST_KEYS_SECRET (opcional no .env).
 * Em desenvolvimento (NODE_ENV=development) pode chamar sem query.
 */
export async function GET(request) {
  const isDev = process.env.NODE_ENV === 'development';
  const testKey = process.env.TEST_KEYS_SECRET || '';
  const queryKey = request.nextUrl.searchParams.get('key');

  // Em produção exige ?key=TEST_KEYS_SECRET (defina no .env). Em dev pode chamar sem.
  if (!isDev) {
    if (!testKey || queryKey !== testKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const EXTENSION_SECRET = process.env.EXTENSION_SECRET || '';
  const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
  const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

  const checks = {
    EXTENSION_SECRET: EXTENSION_SECRET.length > 0 ? 'set' : 'missing',
    TWITCH_CLIENT_ID: TWITCH_CLIENT_ID.length > 0 ? 'set' : 'missing',
    TWITCH_CLIENT_SECRET: TWITCH_CLIENT_SECRET.length > 0 ? 'set' : 'missing',
    NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL.length > 0 ? 'set' : 'missing',
  };

  const twitchOAuthOk = { ok: false, message: '' };
  const twitchValidateOk = { ok: false, message: '' };

  if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
    try {
      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
      });

      const tokenData = await tokenRes.json().catch(() => ({}));

      if (!tokenRes.ok) {
        twitchOAuthOk.message =
          tokenData.message || tokenData.error || tokenRes.statusText || `HTTP ${tokenRes.status}`;
      } else if (tokenData.access_token) {
        twitchOAuthOk.ok = true;
        twitchOAuthOk.message = 'token obtained';

        const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (validateRes.ok) {
          const validateData = await validateRes.json().catch(() => ({}));
          twitchValidateOk.ok = true;
          twitchValidateOk.message = `client_id=${validateData.client_id?.slice(-4) ?? 'ok'}`;
        } else {
          twitchValidateOk.message = `validate failed: ${validateRes.status}`;
        }
      } else {
        twitchOAuthOk.message = 'no access_token in response';
      }
    } catch (err) {
      twitchOAuthOk.message = err instanceof Error ? err.message : String(err);
    }
  }

  const allSet =
    checks.EXTENSION_SECRET === 'set' &&
    checks.TWITCH_CLIENT_ID === 'set' &&
    checks.TWITCH_CLIENT_SECRET === 'set' &&
    checks.NEXT_PUBLIC_APP_URL === 'set';

  const keysOk = allSet && twitchOAuthOk.ok;

  return NextResponse.json({
    ok: keysOk,
    checks,
    twitch: {
      oauth2_token: twitchOAuthOk,
      oauth2_validate: twitchValidateOk.ok ? twitchValidateOk : undefined,
    },
  });
}
