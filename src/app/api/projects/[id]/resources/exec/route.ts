import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { execInPod } from '@/lib/k8s';
import { canExecInEnvironment } from '@/lib/policies/runtime-access';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json();
    const { podName, containerName, command, environmentId } = body;

    if (!podName || !command) {
      return NextResponse.json({ error: 'Pod name and command required' }, { status: 400 });
    }

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    const environment = await getProjectEnvironmentOrThrow(id, environmentId);

    if (!canExecInEnvironment(member.role, environment)) {
      return NextResponse.json(
        {
          error: environment.isProduction
            ? '生产环境只允许 owner 或 admin 执行 Pod 命令'
            : '当前成员角色没有权限执行 Pod 命令',
        },
        { status: 403 }
      );
    }

    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    const commandArray = Array.isArray(command) ? command : command.split(' ');
    const result = await execInPod(
      environment.namespace,
      podName,
      containerName || 'main',
      commandArray
    );

    return NextResponse.json({ output: result });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
