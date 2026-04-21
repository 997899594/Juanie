/**
 * 环境变量 API - 更新 & 删除
 *
 * PUT    /api/projects/[id]/env-vars/[varId]
 * DELETE /api/projects/[id]/env-vars/[varId]
 */

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProjectAccessWithRoleOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environmentVariables } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { isK8sAvailable, rolloutRestartDeployments } from '@/lib/k8s';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string; varId: string }> };
const routeLogger = logger.child({ route: 'api/projects/env-var-detail' });

// ============================================
// PUT - 更新环境变量
// ============================================

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
    await getProjectAccessWithRoleOrThrow(
      projectId,
      session.user.id,
      ['owner', 'admin'] as const,
      '环境变量变更只允许 owner 或 admin'
    );

    const envVar = await db.query.environmentVariables.findFirst({
      where: and(eq(environmentVariables.id, varId), eq(environmentVariables.projectId, projectId)),
    });

    if (!envVar) {
      return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
    }

    let body: z.infer<typeof updateEnvVarSchema>;
    try {
      body = updateEnvVarSchema.parse(await request.json());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body', details: e }, { status: 400 });
    }

    const { key, value, isSecret } = body;
    const updateData: Partial<{
      key: string;
      value: string | null;
      isSecret: boolean;
      encryptedValue: string | null;
      iv: string | null;
      authTag: string | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (key !== undefined) updateData.key = key;

    const finalIsSecret = isSecret !== undefined ? isSecret : envVar.isSecret;

    const encryptOrFail = async (plaintext: string) => {
      try {
        return await encrypt(plaintext);
      } catch (e) {
        routeLogger.error('Failed to encrypt secret value during variable update', e, {
          projectId,
          variableId: varId,
        });
        return null;
      }
    };

    if (value !== undefined) {
      if (finalIsSecret) {
        const encrypted = await encryptOrFail(value);
        if (!encrypted) {
          return NextResponse.json(
            {
              error: 'Encryption unavailable',
              details:
                'Check K8s Secret juanie/juanie-master-key or ENCRYPTION_MASTER_KEY env var.',
            },
            { status: 500 }
          );
        }
        updateData.value = null;
        updateData.encryptedValue = encrypted.encryptedValue;
        updateData.iv = encrypted.iv;
        updateData.authTag = encrypted.authTag;
        updateData.isSecret = true;
      } else {
        updateData.value = value;
        updateData.encryptedValue = null;
        updateData.iv = null;
        updateData.authTag = null;
        updateData.isSecret = false;
      }
    } else if (isSecret !== undefined && isSecret !== envVar.isSecret) {
      if (isSecret && envVar.value !== null) {
        const encrypted = await encryptOrFail(envVar.value);
        if (!encrypted) {
          return NextResponse.json(
            {
              error: 'Encryption unavailable',
              details:
                'Check K8s Secret juanie/juanie-master-key or ENCRYPTION_MASTER_KEY env var.',
            },
            { status: 500 }
          );
        }
        updateData.value = null;
        updateData.encryptedValue = encrypted.encryptedValue;
        updateData.iv = encrypted.iv;
        updateData.authTag = encrypted.authTag;
      } else if (!isSecret && envVar.encryptedValue) {
        return NextResponse.json(
          { error: 'Cannot change a secret to non-secret without providing a new value' },
          { status: 400 }
        );
      }
      updateData.isSecret = isSecret;
    }

    await db.update(environmentVariables).set(updateData).where(eq(environmentVariables.id, varId));

    if (envVar.environmentId) {
      await syncEnvVarsToK8s(projectId, envVar.environmentId).catch((e) => {
        routeLogger.warn('Failed to sync env vars to Kubernetes after update', {
          projectId,
          variableId: varId,
          environmentId: envVar.environmentId,
          reason: e instanceof Error ? e.message : String(e),
        });
      });

      if (isK8sAvailable()) {
        const environment = await getProjectEnvironmentOrThrow(projectId, envVar.environmentId);
        if (environment.namespace) {
          await rolloutRestartDeployments(environment.namespace).catch((e) => {
            routeLogger.warn('Failed to trigger rollout restart after env var update', {
              projectId,
              variableId: varId,
              environmentId: envVar.environmentId,
              namespace: environment.namespace,
              reason: e instanceof Error ? e.message : String(e),
            });
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ============================================
// DELETE - 删除环境变量
// ============================================

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, varId } = await params;
    const session = await requireSession();
    await getProjectAccessWithRoleOrThrow(
      projectId,
      session.user.id,
      ['owner', 'admin'] as const,
      '环境变量变更只允许 owner 或 admin'
    );

    const envVar = await db.query.environmentVariables.findFirst({
      where: and(eq(environmentVariables.id, varId), eq(environmentVariables.projectId, projectId)),
    });

    if (!envVar) {
      return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
    }

    await db.delete(environmentVariables).where(eq(environmentVariables.id, varId));

    if (envVar.environmentId) {
      await syncEnvVarsToK8s(projectId, envVar.environmentId).catch((e) => {
        routeLogger.warn('Failed to sync env vars to Kubernetes after delete', {
          projectId,
          variableId: varId,
          environmentId: envVar.environmentId,
          reason: e instanceof Error ? e.message : String(e),
        });
      });

      if (isK8sAvailable()) {
        const environment = await getProjectEnvironmentOrThrow(projectId, envVar.environmentId);
        if (environment.namespace) {
          await rolloutRestartDeployments(environment.namespace).catch((e) => {
            routeLogger.warn('Failed to trigger rollout restart after env var delete', {
              projectId,
              variableId: varId,
              environmentId: envVar.environmentId,
              namespace: environment.namespace,
              reason: e instanceof Error ? e.message : String(e),
            });
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
