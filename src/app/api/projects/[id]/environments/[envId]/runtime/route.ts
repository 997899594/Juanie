import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { createAuditLog } from '@/lib/audit';
import { setEnvironmentRuntimeState } from '@/lib/environments/runtime-control';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { persistLatestEnvironmentReleaseRecap } from '@/lib/releases/recap-service';

const runtimeControlSchema = z.object({
  action: z.enum(['sleep', 'wake']),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const body = await request.json().catch(() => null);
    const parsed = runtimeControlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '运行态操作无效' }, { status: 400 });
    }

    const { project, member, environment } = await getProjectEnvironmentAccessOrThrow(
      id,
      envId,
      session.user.id
    );

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const runtimeState = await setEnvironmentRuntimeState({
      project,
      environment,
      action: parsed.data.action,
    });

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
        action: parsed.data.action === 'sleep' ? 'sleep_runtime' : 'wake_runtime',
        mode: 'manual',
        runtimeState,
      },
    });

    await persistLatestEnvironmentReleaseRecap({
      projectId: id,
      environmentId: environment.id,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      action: parsed.data.action,
      runtimeState,
      summary:
        parsed.data.action === 'sleep'
          ? `${environment.name} 已休眠应用工作负载`
          : `${environment.name} 已唤醒应用工作负载`,
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
