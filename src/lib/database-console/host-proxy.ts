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

function wantsHtmlError(request: Request): boolean {
  const accept = request.headers.get('accept')?.toLowerCase() ?? '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildConsoleErrorResponse(input: {
  request: Request;
  status: number;
  title: string;
  message: string;
}): Response {
  if (!wantsHtmlError(input.request)) {
    return NextResponse.json({ error: input.message }, { status: input.status });
  }

  const body = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f3ee; color: #1f2933; }
      main { width: min(520px, calc(100vw - 32px)); border: 1px solid #e4ded5; border-radius: 24px; background: #fffaf3; padding: 28px; box-shadow: 0 24px 80px rgba(31, 41, 51, 0.12); }
      h1 { margin: 0; font-size: 20px; line-height: 1.35; }
      p { margin: 12px 0 0; color: #5c6670; line-height: 1.7; }
      a { display: inline-flex; margin-top: 20px; color: #8a4b22; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <a href="https://${escapeHtml(getDbGateConsoleConfig().hostnameBaseDomain)}/">返回 Juanie 后重新打开控制台</a>
    </main>
  </body>
</html>`;

  return new Response(body, {
    status: input.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
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
    return buildConsoleErrorResponse({
      request,
      status: 404,
      title: '数据库控制台未启用',
      message: 'DbGate 控制台未启用。',
    });
  }

  const hostname = normalizeHostname(request.headers.get('host'));
  const parsedHost = hostname
    ? parseDbGateConsoleHostname({ hostname, baseDomain: config.hostnameBaseDomain })
    : null;

  if (!parsedHost) {
    return buildConsoleErrorResponse({
      request,
      status: 404,
      title: '数据库控制台地址无效',
      message: 'Unknown database console host',
    });
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
    return buildConsoleErrorResponse({
      request,
      status: 401,
      title: '数据库控制台会话已过期',
      message: '请回到 Juanie 数据库页面，重新点击“控制台”打开新的临时会话。',
    });
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
      return buildConsoleErrorResponse({
        request,
        status: 503,
        title: '数据库控制台暂不可达',
        message: 'DbGate 控制台仍在启动或已被空闲回收，请回到 Juanie 重新打开控制台。',
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return buildConsoleErrorResponse({
      request,
      status: 500,
      title: '数据库控制台打开失败',
      message,
    });
  }
}
