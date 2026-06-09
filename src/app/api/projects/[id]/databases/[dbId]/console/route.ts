import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';
import { isDbGateSupportedDatabaseType } from '@/lib/database-console/dbgate';
import { openDbGateDatabaseConsole } from '@/lib/database-console/dbgate-session';
import { db } from '@/lib/db';
import { databases, environments } from '@/lib/db/schema';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id, dbId } = await params;
    const session = await requireSession();
    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);

    if (!canReadProjectRuntime(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const database = await db.query.databases.findFirst({
      where: and(eq(databases.id, dbId), eq(databases.projectId, id)),
    });

    if (!database) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    if (!database.environmentId) {
      return NextResponse.json({ error: 'Database has no environment' }, { status: 409 });
    }

    if (!isDbGateSupportedDatabaseType(database.type)) {
      return NextResponse.json({ error: '当前数据库类型不支持 DbGate 控制台' }, { status: 400 });
    }

    const environment = await db.query.environments.findFirst({
      where: and(eq(environments.id, database.environmentId), eq(environments.projectId, id)),
    });

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const result = await openDbGateDatabaseConsole({
      project,
      environment,
      database,
      actor: {
        email: session.user.email,
        name: session.user.name,
      },
    });

    await createAuditLog({
      teamId: project.teamId,
      userId: session.user.id,
      action: 'database.console_opened',
      resourceType: 'database',
      resourceId: database.id,
      metadata: {
        projectId: project.id,
        environmentId: environment.id,
        provider: result.provider,
        deploymentName: result.deploymentName,
        serviceName: result.serviceName,
        readonly: result.readonly,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
