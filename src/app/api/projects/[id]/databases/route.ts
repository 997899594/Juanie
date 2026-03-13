import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { databases, projects, teamMembers } from '@/lib/db/schema';
import { getIsConnected, initK8sClient } from '@/lib/k8s';
import { injectDatabaseEnvVars, provisionDatabase } from '@/lib/queue/project-init';

function getHasK8s(): boolean {
  try {
    initK8sClient();
    return getIsConnected();
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbList = await db.query.databases.findMany({
    where: eq(databases.projectId, id),
  });

  return NextResponse.json(dbList);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember || !['owner', 'admin'].includes(teamMember.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, provisionType = 'shared', externalUrl, plan = 'starter' } = body;

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
  }

  const validTypes = ['postgresql', 'mysql', 'redis', 'mongodb'];
  const validProvisionTypes = ['shared', 'standalone', 'external'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }
  if (!validProvisionTypes.includes(provisionType)) {
    return NextResponse.json(
      { error: `Invalid provisionType. Must be one of: ${validProvisionTypes.join(', ')}` },
      { status: 400 }
    );
  }
  if (provisionType === 'external' && !externalUrl) {
    return NextResponse.json(
      { error: 'externalUrl is required for external provision type' },
      { status: 400 }
    );
  }

  try {
    const [dbRecord] = await db
      .insert(databases)
      .values({
        projectId: id,
        name,
        type,
        plan,
        provisionType,
        connectionString: provisionType === 'external' ? externalUrl : null,
        status: 'pending',
      })
      .returning();

    const hasK8s = getHasK8s();
    await provisionDatabase(dbRecord, project, hasK8s);

    const updated = await db.query.databases.findFirst({
      where: eq(databases.id, dbRecord.id),
    });

    if (updated?.connectionString) {
      await injectDatabaseEnvVars(updated, project);
    }

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error('Failed to provision database:', error);
    return NextResponse.json(
      {
        error: 'Failed to provision database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
