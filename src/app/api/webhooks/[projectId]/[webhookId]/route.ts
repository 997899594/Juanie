import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';

export async function POST(
  _request: Request,
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

  return NextResponse.json(
    {
      error:
        'Legacy push webhook deployment is removed. Use registry webhooks or POST /api/releases.',
    },
    { status: 410 }
  );
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
