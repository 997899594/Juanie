import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { cleanupStuckTerminatingPods, rolloutRestartDeployments } from '@/lib/k8s';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { persistLatestEnvironmentReleaseRecap } from '@/lib/releases/recap-service';

type RemediationAction = 'restart_deployments' | 'cleanup_terminating_pods';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as RemediationAction | undefined;
  const environmentId = body?.environmentId as string | undefined;

  if (!action || !environmentId) {
    return NextResponse.json({ error: 'Missing action or environmentId' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const environment = await db.query.environments.findFirst({
    where: and(eq(environments.id, environmentId), eq(environments.projectId, id)),
  });
  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  if (!canManageEnvironment(member.role, environment)) {
    return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
  }

  try {
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

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Remediation failed',
      },
      { status: 500 }
    );
  }
}
