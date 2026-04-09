import { and, desc, eq, ilike } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    await getTeamAccessOrThrow(id, session.user.id);

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.teamId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (action) {
      query = db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.teamId, id), ilike(auditLogs.action, `%${action}%`)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const logs = await query;

    return NextResponse.json(logs);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
