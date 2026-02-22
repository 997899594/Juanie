import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhooksList = await db.query.webhooks.findMany({
    where: eq(webhooks.projectId, id),
  });

  return NextResponse.json(webhooksList);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, events, active = true } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const secret = nanoid(32);

  const [webhook] = await db
    .insert(webhooks)
    .values({
      projectId: id,
      url,
      events: events || ['deployment'],
      secret,
      active,
    })
    .returning();

  return NextResponse.json(webhook, { status: 201 });
}
