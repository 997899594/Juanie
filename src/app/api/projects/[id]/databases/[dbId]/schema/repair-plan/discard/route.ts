import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  discardLatestSchemaRepairPlanForDatabase,
  isSchemaManagementActionError,
} from '@/lib/schema-safety';

export async function POST(_request: Request, context: { params: Promise<unknown> }) {
  try {
    const { id: projectId, dbId } = (await context.params) as { id: string; dbId: string };
    const session = await requireSession();
    const plan = await discardLatestSchemaRepairPlanForDatabase({
      projectId,
      databaseId: dbId,
      userId: session.user.id,
    });

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    if (isSchemaManagementActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
