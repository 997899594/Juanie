import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> },
) {
  const { id, webhookId } = await params

  const { url, events, active } = await request.json()

  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.id, webhookId),
  })

  if (!webhook || webhook.projectId !== id) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
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
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> },
) {
  const { id, webhookId } = await params

  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.id, webhookId),
  })

  if (!webhook || webhook.projectId !== id) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  await db.delete(webhooks).where(eq(webhooks.id, webhookId))

  return NextResponse.json({ success: true })
}
