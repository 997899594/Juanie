import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { domains, services } from '@/lib/db/schema';
import { isProductionEnvironment } from '@/lib/environments/model';
import {
  getEnvironmentRuntimeState,
  setEnvironmentRuntimeState,
} from '@/lib/environments/runtime-control';

export const runtime = 'nodejs';

function normalizeHostname(value: string | null): string | null {
  const hostname = value?.split(',')[0]?.trim().toLowerCase();
  if (!hostname) {
    return null;
  }

  return hostname.split(':')[0] ?? null;
}

function getReturnPath(url: URL): string {
  const path = url.searchParams.get('path');
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return '/';
  }

  return path;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildWakePage(input: {
  hostname: string;
  returnPath: string;
  title: string;
  summary: string;
  status: 'waking' | 'ready' | 'blocked';
}): string {
  const refreshSeconds = input.status === 'ready' ? 1 : input.status === 'waking' ? 4 : 0;
  const safePath = escapeHtml(input.returnPath);
  const refreshMarkup =
    refreshSeconds > 0
      ? `<meta http-equiv="refresh" content="${refreshSeconds};url=${safePath}"><script>setTimeout(() => location.replace(${JSON.stringify(input.returnPath)}), ${refreshSeconds * 1000});</script>`
      : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)} · Juanie</title>
  ${refreshMarkup}
  <style>
    :root {
      color-scheme: light;
      --ink: #302f2a;
      --muted: #706b61;
      --paper: #f7f4ec;
      --card: rgba(255, 252, 244, 0.86);
      --line: rgba(48, 47, 42, 0.1);
      --accent: #4d7b5c;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 28px;
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 18% 18%, rgba(77, 123, 92, 0.2), transparent 30%),
        radial-gradient(circle at 82% 16%, rgba(183, 132, 72, 0.18), transparent 28%),
        linear-gradient(135deg, #fbf8f0 0%, var(--paper) 52%, #eee7d8 100%);
    }
    main {
      width: min(680px, 100%);
      padding: 42px;
      border: 1px solid var(--line);
      border-radius: 34px;
      background: var(--card);
      box-shadow: 0 28px 90px rgba(48, 47, 42, 0.13);
      backdrop-filter: blur(18px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font: 700 13px/1 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 8px rgba(77, 123, 92, 0.12);
    }
    h1 {
      margin: 24px 0 14px;
      font-size: clamp(34px, 6vw, 64px);
      line-height: 0.98;
      letter-spacing: -0.06em;
    }
    p {
      margin: 0;
      color: var(--muted);
      font: 500 17px/1.8 ui-sans-serif, system-ui, sans-serif;
    }
    .host {
      margin-top: 28px;
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.52);
      color: var(--ink);
      font: 700 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow"><span class="dot"></span>${input.status === 'blocked' ? 'Action needed' : 'Auto wake'}</div>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.summary)}</p>
    <div class="host">${escapeHtml(input.hostname)}</div>
  </main>
</body>
</html>`;
}

function html(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hostname = normalizeHostname(
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  );

  if (!hostname) {
    return html(
      buildWakePage({
        hostname: 'unknown',
        returnPath: '/',
        title: '没有识别到访问域名',
        summary: 'Juanie 无法判断需要唤醒哪个环境。',
        status: 'blocked',
      }),
      400
    );
  }

  const domain = await db.query.domains.findFirst({
    where: eq(domains.hostname, hostname),
    with: {
      project: true,
      environment: true,
      service: true,
    },
  });

  if (!domain?.project || !domain.environment) {
    return html(
      buildWakePage({
        hostname,
        returnPath: '/',
        title: '这个域名还没有接入环境',
        summary: '请先在 Juanie 里完成环境域名绑定。',
        status: 'blocked',
      }),
      404
    );
  }

  const returnPath = getReturnPath(url);
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, domain.project.id),
    columns: {
      id: true,
      name: true,
      type: true,
      isPublic: true,
      port: true,
      replicas: true,
    },
  });
  const domainService = domain.serviceId
    ? serviceList.find((service) => service.id === domain.serviceId)
    : null;
  const hasPublicWebService = serviceList.some(
    (service) => service.type === 'web' && service.isPublic !== false
  );

  if (
    !hasPublicWebService ||
    (domainService && (domainService.type !== 'web' || domainService.isPublic === false))
  ) {
    return html(
      buildWakePage({
        hostname,
        returnPath,
        title: '这个环境没有公开 Web 服务',
        summary: 'Juanie 只会通过公开 Web 域名唤醒应用工作负载。',
        status: 'blocked',
      }),
      404
    );
  }

  if (isProductionEnvironment(domain.environment)) {
    return html(
      buildWakePage({
        hostname,
        returnPath,
        title: '生产环境不经过自动唤醒',
        summary: '生产环境应保持常驻运行。如果你看到这个页面，说明域名路由需要重新同步。',
        status: 'blocked',
      }),
      409
    );
  }

  let runtimeState = await getEnvironmentRuntimeState({
    project: domain.project,
    environment: domain.environment,
    services: serviceList,
  });

  if (runtimeState.state !== 'not_deployed' && runtimeState.state !== 'unknown') {
    try {
      runtimeState = await setEnvironmentRuntimeState({
        project: domain.project,
        environment: domain.environment,
        action: 'wake',
        waitForReadyMs: 2_000,
      });
    } catch (error) {
      return html(
        buildWakePage({
          hostname,
          returnPath,
          title: '自动唤醒失败',
          summary: error instanceof Error ? error.message : '环境运行态暂时不可控。',
          status: 'blocked',
        }),
        500
      );
    }
  }

  if (runtimeState.state === 'running') {
    return html(
      buildWakePage({
        hostname,
        returnPath,
        title: '环境已经唤醒',
        summary: '正在把流量切回应用服务，页面会自动进入原链接。',
        status: 'ready',
      })
    );
  }

  if (runtimeState.state === 'not_deployed' || runtimeState.state === 'unknown') {
    return html(
      buildWakePage({
        hostname,
        returnPath,
        title: '环境暂时不能自动唤醒',
        summary: runtimeState.summary,
        status: 'blocked',
      }),
      409
    );
  }

  return html(
    buildWakePage({
      hostname,
      returnPath,
      title: '正在唤醒环境',
      summary: `${runtimeState.summary}。Juanie 会保留数据库与配置，只恢复应用工作负载。`,
      status: 'waking',
    })
  );
}
