/**
 * 环境变量 API - 列表 & 创建
 *
 * GET  /api/projects/[id]/env-vars?environmentId=&serviceId=
 * POST /api/projects/[id]/env-vars
 */

import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProjectAccessOrThrow,
  getProjectAccessWithRoleOrThrow,
  getProjectEnvironmentOrThrow,
  getProjectServiceOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environmentVariables } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { resolveEnvironmentVariableScope } from '@/lib/env-vars/scope';
import { isK8sAvailable, rolloutRestartDeployments } from '@/lib/k8s';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };
const routeLogger = logger.child({ route: 'api/projects/env-vars' });

// ============================================
// GET - 列出环境变量
// ============================================

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await requireSession();
    await getProjectAccessOrThrow(projectId, session.user.id);

    const url = new URL(request.url);
    const environmentId = url.searchParams.get('environmentId');
    const serviceId = url.searchParams.get('serviceId');

    if (environmentId) {
      await getProjectEnvironmentOrThrow(projectId, environmentId);
    }
    if (serviceId) {
      await getProjectServiceOrThrow(projectId, serviceId);
    }

    try {
      resolveEnvironmentVariableScope({ environmentId, serviceId });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid environment variable scope' },
        { status: 400 }
      );
    }

    const conditions = [eq(environmentVariables.projectId, projectId)];
    if (environmentId) {
      conditions.push(eq(environmentVariables.environmentId, environmentId));
    } else {
      conditions.push(isNull(environmentVariables.environmentId));
    }
    if (serviceId) {
      conditions.push(eq(environmentVariables.serviceId, serviceId));
    } else {
      conditions.push(isNull(environmentVariables.serviceId));
    }

    const vars = await db.query.environmentVariables.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        key: true,
        value: true,
        isSecret: true,
        environmentId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
        encryptedValue: false,
        iv: false,
        authTag: false,
      },
    });

    const safeVars = vars.map((v) => ({
      ...v,
      value: v.isSecret ? null : v.value,
    }));

    return NextResponse.json(safeVars);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ============================================
// POST - 创建环境变量
// ============================================

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
    await getProjectAccessWithRoleOrThrow(
      projectId,
      session.user.id,
      ['owner', 'admin'] as const,
      '环境变量变更只允许 owner 或 admin'
    );

    let body: z.infer<typeof createEnvVarSchema>;
    try {
      body = createEnvVarSchema.parse(await request.json());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body', details: e }, { status: 400 });
    }

    const { key, value, isSecret, environmentId = null, serviceId = null } = body;
    try {
      resolveEnvironmentVariableScope({ environmentId, serviceId });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid environment variable scope' },
        { status: 400 }
      );
    }

    const scopedEnvironment = environmentId
      ? await getProjectEnvironmentOrThrow(projectId, environmentId)
      : null;

    if (serviceId) {
      await getProjectServiceOrThrow(projectId, serviceId);
    }

    const existing = await db.query.environmentVariables.findFirst({
      where: and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.key, key),
        environmentId
          ? eq(environmentVariables.environmentId, environmentId)
          : isNull(environmentVariables.environmentId),
        serviceId
          ? eq(environmentVariables.serviceId, serviceId)
          : isNull(environmentVariables.serviceId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: `Variable "${key}" already exists in this scope` },
        { status: 409 }
      );
    }

    let insertData: Parameters<typeof db.insert>[0] extends never
      ? never
      : {
          projectId: string;
          key: string;
          value: string | null;
          isSecret: boolean;
          environmentId: string | null;
          serviceId: string | null;
          encryptedValue?: string | null;
          iv?: string | null;
          authTag?: string | null;
        };

    if (isSecret) {
      let encryptedValue: string;
      let iv: string;
      let authTag: string;
      try {
        ({ encryptedValue, iv, authTag } = await encrypt(value));
      } catch (e) {
        routeLogger.error('Failed to encrypt secret value during variable creation', e, {
          projectId,
          environmentId,
          serviceId,
          key,
        });
        return NextResponse.json(
          {
            error: 'Encryption unavailable',
            details:
              e instanceof Error
                ? e.message
                : 'Master key not configured. Check K8s Secret juanie/juanie-master-key or ENCRYPTION_MASTER_KEY env var.',
          },
          { status: 500 }
        );
      }
      insertData = {
        projectId,
        key,
        value: null,
        isSecret: true,
        environmentId: environmentId ?? null,
        serviceId: serviceId ?? null,
        encryptedValue,
        iv,
        authTag,
      };
    } else {
      insertData = {
        projectId,
        key,
        value,
        isSecret: false,
        environmentId: environmentId ?? null,
        serviceId: serviceId ?? null,
        encryptedValue: null,
        iv: null,
        authTag: null,
      };
    }

    const [created] = await db.insert(environmentVariables).values(insertData).returning({
      id: environmentVariables.id,
      key: environmentVariables.key,
      isSecret: environmentVariables.isSecret,
      environmentId: environmentVariables.environmentId,
      serviceId: environmentVariables.serviceId,
      createdAt: environmentVariables.createdAt,
    });

    if (environmentId) {
      await syncEnvVarsToK8s(projectId, environmentId).catch((e) => {
        routeLogger.warn('Failed to sync env vars to Kubernetes after creation', {
          projectId,
          environmentId,
          key,
          reason: e instanceof Error ? e.message : String(e),
        });
      });

      if (isK8sAvailable() && scopedEnvironment?.namespace) {
        await rolloutRestartDeployments(scopedEnvironment.namespace).catch((e) => {
          routeLogger.warn('Failed to trigger rollout restart after env var creation', {
            projectId,
            environmentId,
            namespace: scopedEnvironment.namespace,
            key,
            reason: e instanceof Error ? e.message : String(e),
          });
        });
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
