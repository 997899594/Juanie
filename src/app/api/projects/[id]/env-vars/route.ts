/**
 * 环境变量 API - 列表 & 创建
 *
 * GET  /api/projects/[id]/env-vars?environmentId=&serviceId=
 * POST /api/projects/[id]/env-vars
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/api/access';
import {
  createEnvironmentVariableForProject,
  listEnvironmentVariablesForProject,
} from '@/lib/env-vars/control-service';
import { toEnvVarRouteErrorResponse } from '@/lib/env-vars/route-response';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await requireSession();
    const url = new URL(request.url);
    const environmentId = url.searchParams.get('environmentId');
    const serviceId = url.searchParams.get('serviceId');

    const vars = await listEnvironmentVariablesForProject({
      projectId,
      userId: session.user.id,
      environmentId,
      serviceId,
    });

    return NextResponse.json(vars);
  } catch (error) {
    return toEnvVarRouteErrorResponse(error);
  }
}

const createEnvVarSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Z0-9_]+$/i, 'Key must be alphanumeric with underscores'),
  value: z.string(),
  isSecret: z.boolean().default(false),
  environmentId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await requireSession();
    const payload = createEnvVarSchema.safeParse(await request.json().catch(() => null));

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: payload.error.flatten() },
        { status: 400 }
      );
    }

    const { key, value, isSecret, environmentId, serviceId } = payload.data;
    const created = await createEnvironmentVariableForProject({
      projectId,
      userId: session.user.id,
      key,
      value,
      isSecret,
      environmentId,
      serviceId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return toEnvVarRouteErrorResponse(error);
  }
}
