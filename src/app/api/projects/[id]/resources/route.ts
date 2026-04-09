import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema';
import { getInfrastructureDiagnostics } from '@/lib/infrastructure/diagnostics';
import { getDeployments, getEvents, getK8sClient, getPods, getServices } from '@/lib/k8s';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('type') || 'pods';
    const environmentId = url.searchParams.get('env');

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (!canReadProjectRuntime(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    getK8sClient();
    let data: unknown;

    switch (resourceType) {
      case 'diagnostics': {
        const workloadList = await db.query.services.findMany({
          where: eq(services.projectId, id),
          columns: {
            id: true,
            name: true,
            type: true,
            replicas: true,
            cpuRequest: true,
            memoryRequest: true,
          },
        });

        data = await getInfrastructureDiagnostics({
          namespace: environment.namespace,
          deploymentStrategy: environment.deploymentStrategy,
          workloads: workloadList,
        });
        break;
      }
      case 'pods':
        data = await getPods(environment.namespace);
        break;
      case 'services':
        data = await getServices(environment.namespace);
        break;
      case 'deployments':
        data = await getDeployments(environment.namespace);
        break;
      case 'events':
        data = await getEvents(environment.namespace);
        break;
      default:
        return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
