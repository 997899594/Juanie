import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { GitProviderType } from '@/lib/db/schema';
import { integrationIdentities, projects, repositories } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { acceptSourceDelivery } from '@/lib/source-deliveries/service';

const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024;
const GITHUB_EVENT_HEADER = 'x-github-event';
const GITLAB_EVENT_HEADER = 'x-gitlab-event';

interface SourcePushEvent {
  providerCandidates: GitProviderType[];
  repository: string;
  ref: string;
  beforeSha: string;
  afterSha: string;
  deliveryId: string;
}

const webhookLogger = logger.child({ component: 'source-webhook' });

function requiredWebhookSecret(): string {
  const secret = process.env.JUANIE_SOURCE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('JUANIE_SOURCE_WEBHOOK_SECRET is required');
  return secret;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function verifyGitHubSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return constantTimeEqual(signature, expected);
}

async function readRawBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_WEBHOOK_BYTES) throw new RangeError('Webhook payload is too large');
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_WEBHOOK_BYTES) {
    throw new RangeError('Webhook payload is too large');
  }
  return body;
}

function parsePushEvent(request: Request, rawBody: string): SourcePushEvent | null {
  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const githubEvent = request.headers.get(GITHUB_EVENT_HEADER);
  if (githubEvent) {
    if (githubEvent === 'ping') return null;
    if (githubEvent !== 'push') throw new TypeError('Unsupported GitHub webhook event');
    const repository = (payload.repository as { full_name?: unknown } | undefined)?.full_name;
    const deliveryId = request.headers.get('x-github-delivery');
    if (
      typeof repository !== 'string' ||
      typeof payload.ref !== 'string' ||
      typeof payload.before !== 'string' ||
      typeof payload.after !== 'string' ||
      !deliveryId
    ) {
      throw new TypeError('Invalid GitHub push payload');
    }
    return {
      providerCandidates: ['github'],
      repository,
      ref: payload.ref,
      beforeSha: payload.before,
      afterSha: payload.after,
      deliveryId,
    };
  }

  if (request.headers.get(GITLAB_EVENT_HEADER) !== 'Push Hook') {
    throw new TypeError('Unsupported GitLab webhook event');
  }
  const repository = (payload.project as { path_with_namespace?: unknown } | undefined)
    ?.path_with_namespace;
  const deliveryId =
    request.headers.get('x-gitlab-event-uuid') ?? request.headers.get('x-gitlab-webhook-uuid');
  if (
    typeof repository !== 'string' ||
    typeof payload.ref !== 'string' ||
    typeof payload.before !== 'string' ||
    typeof payload.after !== 'string' ||
    !deliveryId
  ) {
    throw new TypeError('Invalid GitLab push payload');
  }
  return {
    providerCandidates: ['gitlab', 'gitlab-self-hosted'],
    repository,
    ref: payload.ref,
    beforeSha: payload.before,
    afterSha: payload.after,
    deliveryId,
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await readRawBody(request);
    const secret = requiredWebhookSecret();
    const isGitHub = request.headers.has(GITHUB_EVENT_HEADER);
    const signatureValid = isGitHub
      ? verifyGitHubSignature(rawBody, request.headers.get('x-hub-signature-256'), secret)
      : constantTimeEqual(request.headers.get('x-gitlab-token') ?? '', secret);
    if (!signatureValid) {
      return NextResponse.json({ error: 'Invalid source webhook signature' }, { status: 401 });
    }

    const event = parsePushEvent(request, rawBody);
    if (!event) return NextResponse.json({ accepted: true, kind: 'ping' });
    if (!/^[a-f0-9]{40}$/u.test(event.beforeSha) || !/^[a-f0-9]{40}$/u.test(event.afterSha)) {
      return NextResponse.json({ error: 'Invalid source commit identity' }, { status: 400 });
    }
    if (/^0+$/u.test(event.afterSha)) {
      return NextResponse.json({ accepted: true, kind: 'deleted-ref' }, { status: 202 });
    }

    const candidates = await db
      .select({
        project: projects,
        repository: repositories,
        provider: integrationIdentities.provider,
      })
      .from(projects)
      .innerJoin(repositories, eq(projects.repositoryId, repositories.id))
      .innerJoin(integrationIdentities, eq(repositories.providerId, integrationIdentities.id))
      .where(
        and(
          eq(repositories.fullName, event.repository),
          inArray(integrationIdentities.provider, event.providerCandidates)
        )
      );
    const matching = candidates.filter(({ project, repository }) => {
      const branch = project.productionBranch ?? repository.defaultBranch ?? 'main';
      return event.ref === `refs/heads/${branch}`;
    });
    if (matching.length === 0) {
      return NextResponse.json({ accepted: true, kind: 'unbound-ref' }, { status: 202 });
    }
    if (matching.length !== 1) {
      return NextResponse.json({ error: 'Ambiguous source repository binding' }, { status: 409 });
    }

    const [binding] = matching;
    const accepted = await acceptSourceDelivery({
      projectId: binding.project.id,
      repositoryId: binding.repository.id,
      provider: binding.provider,
      providerDeliveryId: event.deliveryId,
      sourceRepository: binding.repository.fullName,
      sourceRef: event.ref,
      sourceCommitSha: event.afterSha,
      beforeCommitSha: event.beforeSha,
      forceFullBuild: /^0+$/u.test(event.beforeSha),
    });
    webhookLogger.info('Accepted source delivery', {
      sourceDeliveryId: accepted.delivery.id,
      provider: binding.provider,
      providerDeliveryId: event.deliveryId,
      projectId: binding.project.id,
      repositoryId: binding.repository.id,
      duplicate: !accepted.created,
    });
    return NextResponse.json(
      {
        accepted: true,
        duplicate: !accepted.created,
        deliveryId: event.deliveryId,
        sourceDeliveryId: accepted.delivery.id,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json({ error: 'Invalid source webhook payload' }, { status: 400 });
    }
    webhookLogger.error('Failed to persist source delivery', error);
    return NextResponse.json({ error: 'Failed to persist source delivery' }, { status: 503 });
  }
}
