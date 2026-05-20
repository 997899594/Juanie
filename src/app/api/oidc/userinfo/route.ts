import { NextResponse } from 'next/server';
import { consumeAccessToken, getUserClaims } from '@/lib/oidc/provider';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const token = consumeAccessToken(authorization.slice('Bearer '.length));
    return NextResponse.json(await getUserClaims(token.userId));
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
}
