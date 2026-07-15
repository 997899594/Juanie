import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { enqueueOutboxMessage } from '@/lib/outbox/service';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { getProjectDeploymentContextOrThrow } from '@/lib/releases/deployment-access';
import { appendReleaseEvent } from '@/lib/releases/events';
import { buildDeploymentRolloutPlan } from '@/lib/releases/rollout';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const { id, depId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const { environment } = await getProjectDeploymentContextOrThrow(id, depId);

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    return NextResponse.json(
      await buildDeploymentRolloutPlan({ projectId: id, deploymentId: depId })
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const { id, depId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const { deployment, environment } = await getProjectDeploymentContextOrThrow(id, depId);

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    if (!deployment.releaseId) {
      return NextResponse.json({ error: '当前部署不属于发布流程' }, { status: 409 });
    }

    const releaseId = deployment.releaseId;
    const commandId = randomUUID();
    await db.transaction(async (tx) => {
      await appendReleaseEvent(tx, {
        releaseId,
        projectId: id,
        environmentId: environment.id,
        actorUserId: session.user.id,
        eventKey: `rollout-requested:${commandId}`,
        type: 'release.rollout.requested',
        data: { deploymentId: depId },
        correlationId: commandId,
      });
      await enqueueOutboxMessage(tx, {
        topic: 'release.rollout.requested',
        aggregateType: 'release',
        aggregateId: releaseId,
        commandId,
        payload: {
          projectId: id,
          deploymentId: depId,
          actorUserId: session.user.id,
          executionKey: `environment:${environment.id}`,
        },
      });
    });

    return NextResponse.json({ accepted: true, commandId }, { status: 202 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
