import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deploymentLogs, deployments } from '@/lib/db/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, depId } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const deployment = await db.query.deployments.findFirst({
      where: and(eq(deployments.id, depId), eq(deployments.projectId, id)),
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const logs = await db.query.deploymentLogs.findMany({
      where: eq(deploymentLogs.deploymentId, depId),
      orderBy: [asc(deploymentLogs.createdAt)],
    });

    return NextResponse.json(logs);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
