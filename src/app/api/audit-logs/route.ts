import { and, desc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, teams } from '@/lib/db/schema';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get('teamId');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
  }

  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.teamId, teamId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const { teamId, action, resourceType, resourceId, metadata } = await request.json();

  if (!teamId || !action || !resourceType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [log] = await db
    .insert(auditLogs)
    .values({
      teamId,
      userId: undefined,
      action,
      resourceType,
      resourceId,
      metadata,
    })
    .returning();

  return NextResponse.json(log, { status: 201 });
}
