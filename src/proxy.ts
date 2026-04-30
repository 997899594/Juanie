import { type NextRequest, NextResponse } from 'next/server';

function normalizeHostname(value: string | null): string | null {
  const hostname = value?.split(',')[0]?.trim().toLowerCase();
  if (!hostname) {
    return null;
  }

  return hostname.split(':')[0] ?? null;
}

function getPlatformBaseDomain(): string {
  return process.env.JUANIE_BASE_DOMAIN?.trim().toLowerCase() || 'juanie.art';
}

function isManagedApplicationHost(hostname: string): boolean {
  const baseDomain = getPlatformBaseDomain();
  return hostname !== baseDomain && hostname.endsWith(`.${baseDomain}`);
}

function shouldBypass(pathname: string): boolean {
  return (
    pathname === '/api/wake' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

export function proxy(request: NextRequest) {
  const hostname = normalizeHostname(request.headers.get('host'));

  if (!hostname || !isManagedApplicationHost(hostname) || shouldBypass(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/api/wake';
  url.search = '';
  url.searchParams.set('path', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
