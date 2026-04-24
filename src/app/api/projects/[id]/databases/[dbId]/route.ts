import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessWithRoleOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { databaseCapabilities, normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { db } from '@/lib/db';
import { databases } from '@/lib/db/schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id, dbId } = await params;
    const session = await requireSession();
    await getProjectAccessWithRoleOrThrow(
      id,
      session.user.id,
      ['owner', 'admin'] as const,
      'Forbidden'
    );

    const body = await request.json();
    const { capabilities } = body;

    if (!Array.isArray(capabilities)) {
      return NextResponse.json({ error: 'capabilities must be an array' }, { status: 400 });
    }

    const normalizedCapabilities = normalizeDatabaseCapabilities(capabilities);
    if (normalizedCapabilities.length !== capabilities.length) {
      return NextResponse.json(
        {
          error: `Invalid capabilities. Must be one of: ${databaseCapabilities.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const existing = await db.query.databases.findFirst({
      where: and(eq(databases.id, dbId), eq(databases.projectId, id)),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    if (existing.type !== 'postgresql' && normalizedCapabilities.length > 0) {
      return NextResponse.json({ error: 'Only PostgreSQL supports capabilities' }, { status: 400 });
    }

    const [updated] = await db
      .update(databases)
      .set({
        capabilities: normalizedCapabilities,
        updatedAt: new Date(),
      })
      .where(eq(databases.id, dbId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
