import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectAccessWithRoleOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { databaseCapabilities, normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import {
  getDatabaseSelectionValidationIssues,
  getDefaultDatabaseProvisionType,
  isPlatformDatabaseProvisionType,
  isPlatformDatabaseType,
  platformDatabaseProvisionTypes,
  platformDatabaseTypes,
} from '@/lib/databases/platform-support';
import { db } from '@/lib/db';
import { databases, environments, services } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { pickProductionEnvironment } from '@/lib/environments/model';
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
  try {
    const { id } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(id, session.user.id);

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
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const { project } = await getProjectAccessWithRoleOrThrow(
      id,
      session.user.id,
      ['owner', 'admin'] as const,
      'Forbidden'
    );

    const body = await request.json();
    const {
      name,
      type,
      provisionType,
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

    const validScopes = ['project', 'service'];
    const validRoles = ['primary', 'readonly', 'cache', 'queue', 'analytics'];
    const normalizedCapabilities = normalizeDatabaseCapabilities(capabilities);
    if (!isPlatformDatabaseType(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${platformDatabaseTypes.join(', ')}` },
        { status: 400 }
      );
    }
    if (
      provisionType !== undefined &&
      provisionType !== null &&
      !isPlatformDatabaseProvisionType(provisionType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid provisionType. Must be one of: ${platformDatabaseProvisionTypes.join(', ')}`,
        },
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
    const resolvedProvisionType = provisionType ?? getDefaultDatabaseProvisionType(type);
    const selectionIssues = getDatabaseSelectionValidationIssues({
      type,
      provisionType: resolvedProvisionType,
      externalUrl,
      capabilities: normalizedCapabilities,
    });

    if (selectionIssues.length > 0) {
      return NextResponse.json({ error: selectionIssues[0]?.message }, { status: 400 });
    }

    // Validate environmentId belongs to this project (if provided)
    let resolvedEnvId: string | null = environmentId ?? null;
    if (resolvedEnvId) {
      const env = await db.query.environments.findFirst({
        where: and(eq(environments.id, resolvedEnvId), eq(environments.projectId, id)),
      });
      if (!env) {
        return NextResponse.json(
          { error: 'Environment not found in this project' },
          { status: 404 }
        );
      }
    } else {
      // Default to the project's production environment if no environmentId provided
      const projectEnvironments = await db.query.environments.findMany({
        where: eq(environments.projectId, id),
      });
      resolvedEnvId = pickProductionEnvironment(projectEnvironments)?.id ?? null;
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
          provisionType: resolvedProvisionType,
          scope,
          role,
          capabilities: normalizedCapabilities,
          connectionString: resolvedProvisionType === 'external' ? externalUrl : null,
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
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
