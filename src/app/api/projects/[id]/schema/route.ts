import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { getProjectSchemaCenterData } from '@/lib/schema-management/page-data';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const envId = searchParams.get('env');
    const session = await requireSession();
    const { project, member } = await getProjectAccessOrThrow(id, session.user.id);

    return NextResponse.json(
      await getProjectSchemaCenterData({
        project,
        role: member.role,
        selectedEnvId: envId,
      })
    );
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
