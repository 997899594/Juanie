import { NextResponse } from 'next/server';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';
import { cleanupStuckTerminatingPods, rolloutRestartDeployments } from '@/lib/k8s';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { persistLatestEnvironmentReleaseRecap } from '@/lib/releases/recap-service';
import { cleanupRedundantCandidateResources } from '@/lib/releases/workloads';

type RemediationAction =
  | 'restart_deployments'
  | 'cleanup_terminating_pods'
  | 'cleanup_candidate_workloads';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json().catch(() => null);
    const action = body?.action as RemediationAction | undefined;
    const environmentId = body?.environmentId as string | undefined;

    if (!action || !environmentId) {
      return NextResponse.json({ error: 'Missing action or environmentId' }, { status: 400 });
    }

    const { project, member, environment } = await getProjectEnvironmentAccessOrThrow(
      id,
      environmentId,
      session.user.id
    );

    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    if (action === 'restart_deployments') {
      await rolloutRestartDeployments(environment.namespace);

      await createAuditLog({
        teamId: project.teamId,
        userId: session.user.id,
        action: 'environment.remediation_triggered',
        resourceType: 'environment',
        resourceId: environment.id,
        metadata: {
          projectId: id,
          environmentId: environment.id,
          environmentName: environment.name,
          action,
          mode: 'manual',
        },
      });
      await persistLatestEnvironmentReleaseRecap({
        projectId: id,
        environmentId: environment.id,
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        action,
        summary: `已触发 ${environment.name} 的 Deployment 滚动重启`,
      });
    }

    if (action === 'cleanup_terminating_pods') {
      const podNames = await cleanupStuckTerminatingPods(environment.namespace);

      await createAuditLog({
        teamId: project.teamId,
        userId: session.user.id,
        action: 'environment.remediation_triggered',
        resourceType: 'environment',
        resourceId: environment.id,
        metadata: {
          projectId: id,
          environmentId: environment.id,
          environmentName: environment.name,
          action,
          mode: 'manual',
          podNames,
          podCount: podNames.length,
        },
      });
      await persistLatestEnvironmentReleaseRecap({
        projectId: id,
        environmentId: environment.id,
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        action,
        podNames,
        summary:
          podNames.length > 0
            ? `已清理 ${podNames.length} 个长时间 Terminating 的 Pod`
            : '当前没有需要清理的长时间 Terminating Pod',
      });
    }

    if (action === 'cleanup_candidate_workloads') {
      const candidateNames = await cleanupRedundantCandidateResources(environment.namespace);

      await createAuditLog({
        teamId: project.teamId,
        userId: session.user.id,
        action: 'environment.remediation_triggered',
        resourceType: 'environment',
        resourceId: environment.id,
        metadata: {
          projectId: id,
          environmentId: environment.id,
          environmentName: environment.name,
          action,
          mode: 'manual',
          candidateNames,
          candidateCount: candidateNames.length,
        },
      });
      await persistLatestEnvironmentReleaseRecap({
        projectId: id,
        environmentId: environment.id,
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        action,
        candidateNames,
        summary:
          candidateNames.length > 0
            ? `已清理 ${candidateNames.length} 个冗余 candidate 工作负载`
            : '当前没有需要清理的冗余 candidate 工作负载',
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Remediation failed',
      },
      { status: 500 }
    );
  }
}
