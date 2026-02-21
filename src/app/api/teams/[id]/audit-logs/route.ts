import { and, desc, eq, ilike } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, teamMembers, teams } from '@/lib/db/schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

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
}
