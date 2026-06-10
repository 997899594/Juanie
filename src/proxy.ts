import { type NextRequest, NextResponse } from 'next/server';
import { parseDbGateConsoleHostname } from '@/lib/database-console/dbgate';

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

function getDatabaseConsoleBaseDomain(): string {
  return (
    process.env.DBGATE_HOSTNAME_BASE_DOMAIN?.trim().toLowerCase() ||
    process.env.JUANIE_BASE_DOMAIN?.trim().toLowerCase() ||
    'juanie.art'
  );
}

function isDatabaseConsoleHost(hostname: string): boolean {
  return Boolean(
    parseDbGateConsoleHostname({
      hostname,
      baseDomain: getDatabaseConsoleBaseDomain(),
    })
  );
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

  if (hostname && isDatabaseConsoleHost(hostname)) {
    const url = request.nextUrl.clone();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-juanie-dbgate-path', request.nextUrl.pathname);
    requestHeaders.set('x-juanie-dbgate-search', request.nextUrl.search);
    url.pathname = `/api/database-console/host-proxy${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

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
