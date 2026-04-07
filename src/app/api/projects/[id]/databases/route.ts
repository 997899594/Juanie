import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { databaseCapabilities, normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { db } from '@/lib/db';
import { databases, environments, projects, services, teamMembers } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Optional ?environmentId= and ?serviceId= filters; omit to get all databases for the project
  const url = new URL(request.url);
  const environmentId = url.searchParams.get('environmentId');
  const serviceId = url.searchParams.get('serviceId');

  const conditions = [eq(databases.projectId, id)];
  if (environmentId) {
    conditions.push(eq(databases.environmentId, environmentId));
  }
  if (serviceId) {
    conditions.push(eq(databases.serviceId, serviceId));
  }

  const dbList = await db.query.databases.findMany({
    where: and(...conditions),
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
  const {
    name,
    type,
    provisionType = 'shared',
    externalUrl,
    plan = 'starter',
    environmentId,
    serviceId,
    scope = serviceId ? 'service' : 'project',
    role = 'primary',
    capabilities = [],
  } = body;

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
  }

  const validTypes = ['postgresql', 'mysql', 'redis', 'mongodb'];
  const validProvisionTypes = ['shared', 'standalone', 'external'];
  const validScopes = ['project', 'service'];
  const validRoles = ['primary', 'readonly', 'cache', 'queue', 'analytics'];
  const normalizedCapabilities = normalizeDatabaseCapabilities(capabilities);
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
  if (!validScopes.includes(scope)) {
    return NextResponse.json(
      { error: `Invalid scope. Must be one of: ${validScopes.join(', ')}` },
      { status: 400 }
    );
  }
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
      { status: 400 }
    );
  }
  if (!Array.isArray(capabilities)) {
    return NextResponse.json({ error: 'capabilities must be an array' }, { status: 400 });
  }
  if (normalizedCapabilities.length !== capabilities.length) {
    return NextResponse.json(
      {
        error: `Invalid capabilities. Must be one of: ${databaseCapabilities.join(', ')}`,
      },
      { status: 400 }
    );
  }
  if (normalizedCapabilities.length > 0 && type !== 'postgresql') {
    return NextResponse.json(
      { error: 'database capabilities 目前只支持 postgresql' },
      { status: 400 }
    );
  }
  if (provisionType === 'external' && !externalUrl) {
    return NextResponse.json(
      { error: 'externalUrl is required for external provision type' },
      { status: 400 }
    );
  }

  // Validate environmentId belongs to this project (if provided)
  let resolvedEnvId: string | null = environmentId ?? null;
  if (resolvedEnvId) {
    const env = await db.query.environments.findFirst({
      where: and(eq(environments.id, resolvedEnvId), eq(environments.projectId, id)),
    });
    if (!env) {
      return NextResponse.json({ error: 'Environment not found in this project' }, { status: 404 });
    }
  } else {
    // Default to the project's production environment if no environmentId provided
    const prodEnv = await db.query.environments.findFirst({
      where: and(
        eq(environments.projectId, id),
        eq(environments.name, 'production'),
        isNull(environments.isPreview)
      ),
    });
    resolvedEnvId = prodEnv?.id ?? null;
  }

  if (serviceId) {
    const service = await db.query.services.findFirst({
      where: and(eq(services.id, serviceId), eq(services.projectId, id)),
    });
    if (!service) {
      return NextResponse.json({ error: 'Service not found in this project' }, { status: 404 });
    }
  }

  try {
    const [dbRecord] = await db
      .insert(databases)
      .values({
        projectId: id,
        environmentId: resolvedEnvId,
        serviceId: serviceId ?? null,
        name,
        type,
        plan,
        provisionType,
        scope,
        role,
        capabilities: normalizedCapabilities,
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
      await injectDatabaseEnvVars(updated, project, updated.environmentId ?? null);
      // Immediately sync to K8s so the env var is available without waiting for next deploy
      if (updated.environmentId) {
        await syncEnvVarsToK8s(id, updated.environmentId).catch((e) =>
          console.warn('[databases POST] syncEnvVarsToK8s failed:', e)
        );
      }
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
