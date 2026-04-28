import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectEnvironmentAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { inferEnvironmentDeploymentRuntime } from '@/lib/environments/model';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';

const updateEnvironmentSchema = z.object({
  deploymentStrategy: z.enum(['rolling', 'controlled', 'canary', 'blue_green']),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const { environment } = await getProjectEnvironmentAccessOrThrow(id, envId, session.user.id);

    return NextResponse.json({
      id: environment.id,
      name: environment.name,
      namespace: environment.namespace,
      kind: environment.kind,
      isProduction: environment.isProduction,
      isPreview: environment.isPreview,
      deploymentStrategy: environment.deploymentStrategy,
      deploymentRuntime: environment.deploymentRuntime,
      deliveryMode: environment.deliveryMode,
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const session = await requireSession();
    const { member, environment } = await getProjectEnvironmentAccessOrThrow(
      id,
      envId,
      session.user.id
    );

    if (!canManageEnvironment(member.role, environment)) {
      return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateEnvironmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '发布策略无效' }, { status: 400 });
    }

    const [updated] = await db
      .update(environments)
      .set({
        deploymentStrategy: parsed.data.deploymentStrategy,
        deploymentRuntime: inferEnvironmentDeploymentRuntime(parsed.data.deploymentStrategy),
        updatedAt: new Date(),
      })
      .where(eq(environments.id, envId))
      .returning();

    return NextResponse.json({
      success: true,
      environment: {
        id: updated.id,
        deploymentStrategy: updated.deploymentStrategy,
        deploymentRuntime: updated.deploymentRuntime,
      },
    });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
