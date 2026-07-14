import { timingSafeEqual } from 'node:crypto';
import { collectControlPlaneMetrics, metricsRegistry } from '@/lib/telemetry/metrics';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const expected = process.env.METRICS_BEARER_TOKEN;
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/iu, '') ?? '';
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  await collectControlPlaneMetrics();
  return new Response(await metricsRegistry.metrics(), {
    headers: {
      'content-type': metricsRegistry.contentType,
      'cache-control': 'no-store',
    },
  });
}
