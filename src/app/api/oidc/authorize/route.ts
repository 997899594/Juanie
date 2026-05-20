import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAuthorizationCode, getOidcClientConfig } from '@/lib/oidc/provider';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const scope = url.searchParams.get('scope') ?? 'openid email profile';
  const state = url.searchParams.get('state');
  const nonce = url.searchParams.get('nonce');
  const clientConfig = getOidcClientConfig();

  if (clientId !== clientConfig.clientId || !redirectUri || responseType !== 'code') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const code = createAuthorizationCode({
    userId: session.user.id,
    clientId,
    redirectUri,
    scope,
    nonce,
  });
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) {
    callbackUrl.searchParams.set('state', state);
  }

  redirect(callbackUrl.toString());
}
