import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { gitConnections } from '@/lib/db/schema'

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const teamId = url.searchParams.get('teamId')

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
  }

  const connections = await db.query.gitConnections.findMany({
    where: eq(gitConnections.teamId, teamId),
  })

  return NextResponse.json(
    connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      createdAt: c.createdAt,
    })),
  )
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, provider, accessToken, refreshToken } = await request.json()

  if (!teamId || !provider || !accessToken) {
    return NextResponse.json(
      { error: 'Team ID, provider and access token are required' },
      { status: 400 },
    )
  }

  const existing = await db.query.gitConnections.findFirst({
    where: and(eq(gitConnections.teamId, teamId), eq(gitConnections.provider, provider)),
  })

  if (existing) {
    await db
      .update(gitConnections)
      .set({
        accessToken,
        refreshToken,
        updatedAt: new Date(),
      })
      .where(eq(gitConnections.id, existing.id))

    return NextResponse.json({ id: existing.id, provider, message: 'Updated' })
  }

  const [connection] = await db
    .insert(gitConnections)
    .values({
      teamId,
      provider,
      accessToken,
      refreshToken,
    })
    .returning()

  return NextResponse.json(connection, { status: 201 })
}

export async function DELETE(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const connectionId = url.searchParams.get('id')

  if (!connectionId) {
    return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
  }

  await db.delete(gitConnections).where(eq(gitConnections.id, connectionId))

  return NextResponse.json({ success: true })
}
