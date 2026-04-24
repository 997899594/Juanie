import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  getStoredSchemaStateForDatabase,
  isSchemaManagementActionError,
} from '@/lib/schema-management/control-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id: projectId, dbId } = await params;
    const session = await requireSession();
    const state = await getStoredSchemaStateForDatabase({
      projectId,
      databaseId: dbId,
      userId: session.user.id,
    });
    return NextResponse.json({
      state,
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    if (isSchemaManagementActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
