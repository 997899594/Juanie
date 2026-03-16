import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers, webhooks } from '@/lib/db/schema';

async function authorizeWebhook(projectId: string, webhookId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) return { webhook: null, forbidden: true };

  const webhook = await db.query.webhooks.findFirst({ where: eq(webhooks.id, webhookId) });
  if (!webhook || webhook.projectId !== projectId) return { webhook: null, forbidden: false };

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return { webhook: null, forbidden: false };

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });
  return { webhook, forbidden: !member };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const { id, webhookId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, events, active } = await request.json();

  const { webhook, forbidden } = await authorizeWebhook(id, webhookId, session.user.id);

  if (!webhook) {
    return forbidden
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(webhooks)
    .set({
      ...(url && { url }),
      ...(events && { events }),
      ...(active !== undefined && { active }),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const { id, webhookId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { webhook, forbidden } = await authorizeWebhook(id, webhookId, session.user.id);

  if (!webhook) {
    return forbidden
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));

  return NextResponse.json({ success: true });
}
