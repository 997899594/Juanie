import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  environments,
  projectInitializationSteps,
  projects,
  teamMembers,
  teams,
} from '@/lib/db/schema'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userProjects = await db
    .select({
      project: projects,
      teamName: teams.name,
    })
    .from(projects)
    .innerJoin(teams, eq(teams.id, projects.teamId))
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, session.user.id)),
    )

  return NextResponse.json(userProjects)
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    teamId,
    name,
    description,
    templateId = 'nextjs',
    gitRepository,
    gitBranch = 'main',
  } = await request.json()

  if (!teamId || !name) {
    return NextResponse.json({ error: 'Team ID and name are required' }, { status: 400 })
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)),
  })

  if (!teamMember || !['owner', 'admin', 'member'].includes(teamMember.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`

  const [project] = await db
    .insert(projects)
    .values({
      teamId,
      name,
      slug,
      description,
      templateId,
      gitRepository,
      gitBranch,
      status: 'initializing',
    })
    .returning()

  const envOrder: Record<string, number> = {
    development: 1,
    staging: 2,
    production: 3,
  }

  const envs = await db
    .insert(environments)
    .values([
      { projectId: project.id, name: 'development', order: envOrder.development },
      { projectId: project.id, name: 'staging', order: envOrder.staging },
      { projectId: project.id, name: 'production', order: envOrder.production },
    ])
    .returning()

  const initSteps = [
    { step: 'create_repository', weight: 15 },
    { step: 'push_template', weight: 25 },
    { step: 'create_environments', weight: 10 },
    { step: 'setup_gitops', weight: 35 },
    { step: 'finalize', weight: 15 },
  ]

  await db.insert(projectInitializationSteps).values(
    initSteps.map((s) => ({
      projectId: project.id,
      step: s.step,
      status: 'pending',
      progress: 0,
    })),
  )

  return NextResponse.json(
    {
      project,
      environments: envs,
    },
    { status: 201 },
  )
}
