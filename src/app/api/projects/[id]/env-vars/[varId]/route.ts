/**
 * 环境变量 API - 更新 & 删除
 *
 * PUT    /api/projects/[id]/env-vars/[varId]
 * DELETE /api/projects/[id]/env-vars/[varId]
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/api/access';
import {
  deleteEnvironmentVariableForProject,
  updateEnvironmentVariableForProject,
} from '@/lib/env-vars/control-service';
import { toEnvVarRouteErrorResponse } from '@/lib/env-vars/route-response';

type RouteParams = { params: Promise<{ id: string; varId: string }> };

const updateEnvVarSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Z0-9_]+$/i, 'Key must be alphanumeric with underscores')
    .optional(),
  value: z.string().optional(),
  isSecret: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, varId } = await params;
    const session = await requireSession();
    const payload = updateEnvVarSchema.safeParse(await request.json().catch(() => null));

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: payload.error.flatten() },
        { status: 400 }
      );
    }

    const result = await updateEnvironmentVariableForProject({
      projectId,
      userId: session.user.id,
      variableId: varId,
      key: payload.data.key,
      value: payload.data.value,
      isSecret: payload.data.isSecret,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toEnvVarRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, varId } = await params;
    const session = await requireSession();
    const result = await deleteEnvironmentVariableForProject({
      projectId,
      userId: session.user.id,
      variableId: varId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toEnvVarRouteErrorResponse(error);
  }
}
