import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import {
  executeMigrationRunActionForActor,
  isMigrationRunAction,
} from '@/lib/migrations/control-service';
import {
  getMigrationActionResponseStatus,
  toMigrationRouteErrorResponse,
} from '@/lib/migrations/route-response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id: projectId, runId } = await params;
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (!isMigrationRunAction(action)) {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    const result = await executeMigrationRunActionForActor({
      actorUserId: session.user.id,
      projectId,
      runId,
      action,
      approvalToken: typeof body.approvalToken === 'string' ? body.approvalToken : undefined,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
    });

    return NextResponse.json(result, {
      status: getMigrationActionResponseStatus(action),
    });
  } catch (error) {
    return toMigrationRouteErrorResponse(error);
  }
}
