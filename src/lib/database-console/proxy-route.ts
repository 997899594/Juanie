import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  getDbGateConsoleConfig,
  isDbGateSupportedDatabaseType,
} from '@/lib/database-console/dbgate';
import { buildDbGateConsoleResourceNames } from '@/lib/database-console/dbgate-session';
import { db } from '@/lib/db';
import { databases, environments } from '@/lib/db/schema';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

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

function isNetworkFetchFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message === 'fetch failed' || error.message.includes('fetch failed'))
  );
}

function buildProxyPath(pathSegments: string[] | undefined, requestUrl: string): string {
  const suffix = pathSegments?.length ? `/${pathSegments.map(encodeURIComponent).join('/')}` : '/';
  const search = new URL(requestUrl).search;
  return `${suffix}${search}`;
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

async function loadConsoleContext(projectId: string, databaseId: string, userId: string) {
  const { project, member } = await getProjectAccessOrThrow(projectId, userId);

  if (!canReadProjectRuntime(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const database = await db.query.databases.findFirst({
    where: and(eq(databases.id, databaseId), eq(databases.projectId, projectId)),
  });

  if (!database) {
    return { error: NextResponse.json({ error: 'Database not found' }, { status: 404 }) };
  }

  if (!database.environmentId) {
    return { error: NextResponse.json({ error: 'Database has no environment' }, { status: 409 }) };
  }

  const environment = await db.query.environments.findFirst({
    where: and(eq(environments.id, database.environmentId), eq(environments.projectId, projectId)),
  });

  if (!environment) {
    return { error: NextResponse.json({ error: 'Environment not found' }, { status: 404 }) };
  }

  return { project, database, environment };
}

export async function proxyDbGateRequest(
  request: Request,
  params: { id: string; dbId: string; path?: string[] }
) {
  try {
    const session = await requireSession();
    const loaded = await loadConsoleContext(params.id, params.dbId, session.user.id);

    if ('error' in loaded) {
      return loaded.error;
    }

    const { baseName } = buildDbGateConsoleResourceNames(params.dbId);
    const config = getDbGateConsoleConfig();

    if (!config.enabled) {
      return NextResponse.json({ error: 'DbGate 控制台未启用' }, { status: 404 });
    }

    if (!isDbGateSupportedDatabaseType(loaded.database.type)) {
      return NextResponse.json({ error: '当前数据库类型不支持 DbGate 控制台' }, { status: 400 });
    }

    const targetUrl = `http://${baseName}.${config.namespace}.svc.cluster.local${buildProxyPath(
      params.path,
      request.url
    )}`;
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: copyRequestHeaders(request.headers),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: copyResponseHeaders(response.headers),
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

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
