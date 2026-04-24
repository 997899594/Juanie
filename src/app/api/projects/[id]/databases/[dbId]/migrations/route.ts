import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import {
  createMigrationRunForDatabase,
  executeMigrationRunActionForActor,
  isMigrationRunAction,
  listMigrationRunsForDatabase,
  planMigrationExecutionForDatabase,
} from '@/lib/migrations/control-service';
import {
  getMigrationActionResponseStatus,
  toMigrationRouteErrorResponse,
} from '@/lib/migrations/route-response';

type DatabaseMigrationAction =
  | 'plan'
  | 'run'
  | 'approve'
  | 'retry'
  | 'mark_external_complete'
  | 'mark_external_failed';

function isDatabaseMigrationAction(action: unknown): action is DatabaseMigrationAction {
  return action === 'plan' || action === 'run' || isMigrationRunAction(action);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id: projectId, dbId } = await params;
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const action = body.action ?? 'run';

    if (!isDatabaseMigrationAction(action)) {
      return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }

    if (action === 'plan') {
      const result = await planMigrationExecutionForDatabase({
        projectId,
        databaseId: dbId,
        userId: session.user.id,
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'run') {
      const result = await createMigrationRunForDatabase({
        projectId,
        databaseId: dbId,
        userId: session.user.id,
        confirmationText:
          typeof body.confirmationText === 'string' ? body.confirmationText : undefined,
      });

      return NextResponse.json(result, {
        status: getMigrationActionResponseStatus('run'),
      });
    }

    if (typeof body.runId !== 'string' || body.runId.trim().length === 0) {
      return NextResponse.json({ error: `${action} 操作缺少 runId` }, { status: 400 });
    }

    const result = await executeMigrationRunActionForActor({
      actorUserId: session.user.id,
      projectId,
      runId: body.runId,
      action,
      approvalToken: typeof body.approvalToken === 'string' ? body.approvalToken : undefined,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
      databaseId: dbId,
    });

    return NextResponse.json(result, {
      status: getMigrationActionResponseStatus(action),
    });
  } catch (error) {
    return toMigrationRouteErrorResponse(error);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id: projectId, dbId } = await params;
    const session = await requireSession();
    const runs = await listMigrationRunsForDatabase({
      projectId,
      databaseId: dbId,
      userId: session.user.id,
    });

    return NextResponse.json(runs, { status: 200 });
  } catch (error) {
    return toMigrationRouteErrorResponse(error, '获取迁移历史失败');
  }
}
