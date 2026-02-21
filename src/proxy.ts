import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.next();
  }

  const devUserId = 'dev-user-001';
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-dev-user-id', devUserId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
