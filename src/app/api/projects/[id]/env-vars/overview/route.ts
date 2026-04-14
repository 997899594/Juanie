import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { getEnvironmentVariableOverview } from '@/lib/env-vars/overview';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(projectId, session.user.id);

    const url = new URL(request.url);
    const environmentId = url.searchParams.get('environmentId');

    if (!environmentId) {
      return NextResponse.json({ error: 'Missing environmentId' }, { status: 400 });
    }

    await getProjectEnvironmentOrThrow(projectId, environmentId);

    return NextResponse.json(await getEnvironmentVariableOverview(projectId, environmentId));
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
