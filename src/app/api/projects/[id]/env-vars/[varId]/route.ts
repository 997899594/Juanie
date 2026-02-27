/**
 * 环境变量 API - 更新 & 删除
 *
 * PUT    /api/projects/[id]/env-vars/[varId]
 * DELETE /api/projects/[id]/env-vars/[varId]
 */

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environmentVariables, projects, teamMembers } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';

type RouteParams = { params: Promise<{ id: string; varId: string }> };

async function authorizeProjectAccess(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { error: 'Project not found', status: 404 };

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });
  if (!member) return { error: 'Forbidden', status: 403 };

  return { error: null, status: 200 };
}

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
  const { id: projectId, varId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error, status } = await authorizeProjectAccess(projectId, session.user.id);
  if (error) return NextResponse.json({ error }, { status });

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

  // 构建更新数据
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

  // 判断最终的 isSecret 状态
  const finalIsSecret = isSecret !== undefined ? isSecret : envVar.isSecret;

  if (value !== undefined) {
    if (finalIsSecret) {
      // 重新加密新值
      const encrypted = await encrypt(value);
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
    // isSecret 状态变化但未提供新 value，需要处理数据迁移
    if (isSecret && envVar.value !== null) {
      // 明文 → 加密
      const encrypted = await encrypt(envVar.value);
      updateData.value = null;
      updateData.encryptedValue = encrypted.encryptedValue;
      updateData.iv = encrypted.iv;
      updateData.authTag = encrypted.authTag;
    } else if (!isSecret && envVar.encryptedValue) {
      // 加密 → 明文（需要提供 value，拒绝此操作以防止意外暴露）
      return NextResponse.json(
        { error: 'Cannot change a secret to non-secret without providing a new value' },
        { status: 400 }
      );
    }
    updateData.isSecret = isSecret;
  }

  await db.update(environmentVariables).set(updateData).where(eq(environmentVariables.id, varId));

  // 同步到 K8s
  if (envVar.environmentId) {
    await syncEnvVarsToK8s(projectId, envVar.environmentId).catch((e) => {
      console.error('Failed to sync env vars to K8s after update', e);
    });
  }

  return NextResponse.json({ success: true });
}

// ============================================
// DELETE - 删除环境变量
// ============================================

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: projectId, varId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error, status } = await authorizeProjectAccess(projectId, session.user.id);
  if (error) return NextResponse.json({ error }, { status });

  const envVar = await db.query.environmentVariables.findFirst({
    where: and(eq(environmentVariables.id, varId), eq(environmentVariables.projectId, projectId)),
  });

  if (!envVar) {
    return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
  }

  await db.delete(environmentVariables).where(eq(environmentVariables.id, varId));

  // 同步到 K8s
  if (envVar.environmentId) {
    await syncEnvVarsToK8s(projectId, envVar.environmentId).catch((e) => {
      console.error('Failed to sync env vars to K8s after delete', e);
    });
  }

  return NextResponse.json({ success: true });
}
