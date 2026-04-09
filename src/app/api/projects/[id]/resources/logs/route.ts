import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { getK8sClient, getPodLogs } from '@/lib/k8s';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const url = new URL(request.url);
    const podName = url.searchParams.get('pod');
    const containerName = url.searchParams.get('container');
    const tailLines = parseInt(url.searchParams.get('tail') || '100', 10);
    const environmentId = url.searchParams.get('env');

    if (!podName) {
      return NextResponse.json({ error: 'Pod name required' }, { status: 400 });
    }

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (!canReadProjectRuntime(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    getK8sClient();
    const logs = await getPodLogs(
      environment.namespace,
      podName,
      containerName || undefined,
      tailLines,
      false
    );

    return new NextResponse(logs as string, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // K8s returns 400 when the container hasn't started yet (e.g. ImagePullBackOff / Pending)
    if (errorMessage.includes('HTTP-Code: 400') || errorMessage.includes('is not running')) {
      return NextResponse.json(
        { error: 'Container has not started yet — check pod status for details' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
