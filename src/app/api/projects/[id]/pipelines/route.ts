import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { pipelines } from '@/lib/db/schema'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelinesList = await db.select().from(pipelines).where(eq(pipelines.projectId, id))

  return NextResponse.json(pipelinesList)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, yaml } = await request.json()

  if (!name || !yaml) {
    return NextResponse.json({ error: 'Name and YAML are required' }, { status: 400 })
  }

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      projectId: id,
      name,
      yaml,
    })
    .returning()

  return NextResponse.json(pipeline, { status: 201 })
}
