import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTeamAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }

    await getTeamAccessOrThrow(teamId, session.user.id);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.teamId, teamId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(logs);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error:
        'Direct audit log writes are disabled. Use domain services that enforce authorization.',
    },
    { status: 410 }
  );
}
