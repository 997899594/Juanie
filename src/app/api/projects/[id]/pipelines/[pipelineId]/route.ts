import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { pipelineRuns, pipelines } from '@/lib/db/schema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pipelineId: string }> },
) {
  const { id, pipelineId } = await params

  const { name, yaml } = await request.json()

  const pipeline = await db.query.pipelines.findFirst({
    where: eq(pipelines.id, pipelineId),
  })

  if (!pipeline || pipeline.projectId !== id) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  const [updated] = await db
    .update(pipelines)
    .set({
      ...(name && { name }),
      ...(yaml && { yaml }),
      updatedAt: new Date(),
    })
    .where(eq(pipelines.id, pipelineId))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; pipelineId: string }> },
) {
  const { id, pipelineId } = await params

  const pipeline = await db.query.pipelines.findFirst({
    where: eq(pipelines.id, pipelineId),
  })

  if (!pipeline || pipeline.projectId !== id) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  await db.delete(pipelines).where(eq(pipelines.id, pipelineId))

  return NextResponse.json({ success: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pipelineId: string }> },
) {
  const { id, pipelineId } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipeline = await db.query.pipelines.findFirst({
    where: eq(pipelines.id, pipelineId),
  })

  if (!pipeline || pipeline.projectId !== id) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      pipelineId,
      status: 'running',
      startedAt: new Date(),
    })
    .returning()

  return NextResponse.json(run, { status: 201 })
}
