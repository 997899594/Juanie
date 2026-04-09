import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { getProjectDeploymentContextOrThrow } from '@/lib/releases/deployment-access';
import { buildDeploymentRolloutPlan, finalizeDeploymentRollout } from '@/lib/releases/rollout';

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
    const { environment } = await getProjectDeploymentContextOrThrow(id, depId);

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    return NextResponse.json(
      await finalizeDeploymentRollout({ projectId: id, deploymentId: depId })
    );
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
