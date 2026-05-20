import { NextResponse } from 'next/server';
import {
  assertOidcClient,
  consumeAuthorizationCode,
  createAccessToken,
  createIdToken,
} from '@/lib/oidc/provider';

function readBasicClient(request: Request): {
  clientId: string | null;
  clientSecret: string | null;
} {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Basic ')) {
    return { clientId: null, clientSecret: null };
  }

  const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return { clientId: null, clientSecret: null };
  }

  return {
    clientId: decodeURIComponent(decoded.slice(0, separatorIndex)),
    clientSecret: decodeURIComponent(decoded.slice(separatorIndex + 1)),
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const basicClient = readBasicClient(request);
    const clientId = (form.get('client_id') as string | null) ?? basicClient.clientId;
    const clientSecret = (form.get('client_secret') as string | null) ?? basicClient.clientSecret;
    const code = form.get('code');
    const redirectUri = form.get('redirect_uri');

    assertOidcClient({ clientId, clientSecret });

    if (
      form.get('grant_type') !== 'authorization_code' ||
      typeof code !== 'string' ||
      typeof redirectUri !== 'string' ||
      !clientId
    ) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const payload = consumeAuthorizationCode({
      code,
      clientId,
      redirectUri,
    });
    const accessToken = createAccessToken({
      userId: payload.userId,
      scope: payload.scope,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      id_token: await createIdToken({
        userId: payload.userId,
        clientId,
        nonce: payload.nonce,
      }),
    });
  } catch {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
}
