import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDbGateConsoleConfig, parseDbGateConsoleHostname } from '@/lib/database-console/dbgate';
import { buildDbGateConsoleResourceNames } from '@/lib/database-console/dbgate-session';
import {
  DBGATE_CONSOLE_COOKIE_NAME,
  verifyDbGateConsoleToken,
} from '@/lib/database-console/host-auth';

const HOP_BY_HOP_HEADERS = new Set([
  'authorization',
  'content-length',
  'cookie',
  'connection',
  'keep-alive',
  'host',
  'origin',
  'proxy-authenticate',
  'proxy-authorization',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const RESPONSE_PRIVATE_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  'content-security-policy',
  'set-cookie',
]);

function normalizeHostname(value: string | null): string | null {
  const hostname = value?.split(',')[0]?.trim().toLowerCase();
  if (!hostname) {
    return null;
  }

  return hostname.split(':')[0] ?? null;
}

function isNetworkFetchFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message === 'fetch failed' || error.message.includes('fetch failed'))
  );
}

function copyRequestHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      nextHeaders.set(key, value);
    }
  }
  return nextHeaders;
}

function copyResponseHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    if (!RESPONSE_PRIVATE_HEADERS.has(key.toLowerCase())) {
      nextHeaders.set(key, value);
    }
  }
  return nextHeaders;
}

function getExternalPath(request: Request): string {
  const value = request.headers.get('x-juanie-dbgate-path');
  if (value?.startsWith('/')) {
    return value;
  }

  const url = new URL(request.url);
  const prefix = '/api/database-console/host-proxy';
  if (url.pathname === prefix) {
    return '/';
  }

  if (url.pathname.startsWith(`${prefix}/`)) {
    return url.pathname.slice(prefix.length) || '/';
  }

  return url.pathname;
}

function getExternalSearch(request: Request): string {
  const value = request.headers.get('x-juanie-dbgate-search');
  if (value?.startsWith('?')) {
    return value;
  }

  return new URL(request.url).search;
}

export function buildRelativeRedirectWithoutToken(input: { path: string; search: string }): string {
  const url = new URL(input.path, 'https://dbgate.invalid');
  url.search = input.search;
  url.searchParams.delete('token');

  return `${url.pathname}${url.search}${url.hash}`;
}

function buildRedirectWithoutToken(request: Request): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: buildRelativeRedirectWithoutToken({
        path: getExternalPath(request),
        search: getExternalSearch(request),
      }),
    },
  });
}

function buildUpstreamUrl(input: {
  namespace: string;
  databaseId: string;
  path: string;
  search: string;
}): string {
  const { baseName } = buildDbGateConsoleResourceNames(input.databaseId);
  const upstream = new URL(`http://${baseName}.${input.namespace}.svc.cluster.local/`);
  upstream.pathname = input.path;
  upstream.search = input.search;
  return upstream.toString();
}

async function getDbGateConsoleCookieToken(): Promise<string | null> {
  return (await cookies()).get(DBGATE_CONSOLE_COOKIE_NAME)?.value ?? null;
}

export async function proxyDbGateConsoleHostRequest(request: Request): Promise<Response> {
  const config = getDbGateConsoleConfig();

  if (!config.enabled) {
    return NextResponse.json({ error: 'DbGate 控制台未启用' }, { status: 404 });
  }

  const hostname = normalizeHostname(request.headers.get('host'));
  const parsedHost = hostname
    ? parseDbGateConsoleHostname({ hostname, baseDomain: config.hostnameBaseDomain })
    : null;

  if (!parsedHost) {
    return NextResponse.json({ error: 'Unknown database console host' }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const queryToken = requestUrl.searchParams.get('token');
  const queryPayload = verifyDbGateConsoleToken({
    token: queryToken,
    databaseSlug: parsedHost.databaseSlug,
  });

  if (queryPayload) {
    const response = buildRedirectWithoutToken(request);
    response.cookies.set(DBGATE_CONSOLE_COOKIE_NAME, queryToken!, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      expires: new Date(queryPayload.expiresAt),
    });
    return response;
  }

  const cookiePayload = verifyDbGateConsoleToken({
    token: await getDbGateConsoleCookieToken(),
    databaseSlug: parsedHost.databaseSlug,
  });

  if (!cookiePayload) {
    return NextResponse.json({ error: 'Database console session expired' }, { status: 401 });
  }

  if (queryToken) {
    return buildRedirectWithoutToken(request);
  }

  try {
    const response = await fetch(
      buildUpstreamUrl({
        namespace: config.namespace,
        databaseId: cookiePayload.databaseId,
        path: getExternalPath(request),
        search: getExternalSearch(request),
      }),
      {
        method: request.method,
        headers: copyRequestHeaders(request.headers),
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: copyResponseHeaders(response.headers),
    });
  } catch (error) {
    if (isNetworkFetchFailure(error)) {
      return NextResponse.json(
        { error: 'DbGate 控制台仍在启动或已被空闲回收，请重新打开控制台。' },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
