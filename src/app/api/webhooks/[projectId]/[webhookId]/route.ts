import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deployments, environments, projects, webhooks } from '@/lib/db/schema';

interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
    html_url: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
  const { projectId, webhookId } = await params;

  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.id, webhookId),
  });

  if (!webhook || webhook.projectId !== projectId) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  if (!webhook.active) {
    return NextResponse.json({ error: 'Webhook disabled' }, { status: 400 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (webhook.secret && signature) {
    const expectedSignature = `sha256=${createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const event = request.headers.get('x-github-event');

  if (event === 'push') {
    const data: GitHubPushEvent = JSON.parse(body);
    await handlePushEvent(projectId, data);
  }

  return NextResponse.json({ received: true });
}

async function handlePushEvent(projectId: string, data: GitHubPushEvent) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return;

  const branch = data.ref.replace('refs/heads/', '');

  if (branch !== project.productionBranch) {
    return;
  }

  const envs = await db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
  });

  for (const env of envs) {
    const latestCommit = data.commits[0];

    await db.insert(deployments).values({
      projectId,
      environmentId: env.id,
      commitSha: latestCommit?.id,
      commitMessage: latestCommit?.message,
      status: 'queued',
    });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> }
) {
  const { webhookId } = await params;

  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.id, webhookId),
  });

  if (!webhook) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    active: webhook.active,
    createdAt: webhook.createdAt,
  });
}
