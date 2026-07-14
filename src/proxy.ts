import { type NextRequest, NextResponse } from 'next/server';
import { parseDbGateConsoleHostname } from '@/lib/database-console/dbgate';
import { buildSecurityHeaders } from '@/lib/security/headers';

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
  const security = buildSecurityHeaders();
  const secure = (response: NextResponse): NextResponse => {
    for (const [name, value] of Object.entries(security.headers)) {
      response.headers.set(name, value);
    }
    return response;
  };

  if (hostname && isDatabaseConsoleHost(hostname)) {
    const url = request.nextUrl.clone();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-juanie-dbgate-path', request.nextUrl.pathname);
    requestHeaders.set('x-juanie-dbgate-search', request.nextUrl.search);
    requestHeaders.set('x-nonce', security.nonce);
    requestHeaders.set('Content-Security-Policy', security.headers['Content-Security-Policy']);
    url.pathname = `/api/database-console/host-proxy${request.nextUrl.pathname}`;
    return secure(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  }

  if (!hostname || !isManagedApplicationHost(hostname) || shouldBypass(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', security.nonce);
    requestHeaders.set('Content-Security-Policy', security.headers['Content-Security-Policy']);
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const url = request.nextUrl.clone();
  url.pathname = '/api/wake';
  url.search = '';
  url.searchParams.set('path', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', security.nonce);
  requestHeaders.set('Content-Security-Policy', security.headers['Content-Security-Policy']);
  return secure(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
