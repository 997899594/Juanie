import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, teamMembers, teams } from '@/lib/db/schema'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  })

  if (!teamMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, project.teamId),
  })

  return NextResponse.json({
    ...project,
    teamName: team?.name,
    teamSlug: team?.slug,
    yourRole: teamMember.role,
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  })

  if (!teamMember || !['owner', 'admin'].includes(teamMember.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates = await request.json()

  const allowedFields = ['name', 'description', 'gitRepository', 'gitBranch']
  const filteredUpdates: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = value
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(projects)
    .set({ ...filteredUpdates, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  })

  if (!teamMember || teamMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can delete project' }, { status: 403 })
  }

  await db.delete(projects).where(eq(projects.id, id))

  return NextResponse.json({ success: true })
}
