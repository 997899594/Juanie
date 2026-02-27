/**
 * 环境变量 API - 列表 & 创建
 *
 * GET  /api/projects/[id]/env-vars?environmentId=&serviceId=
 * POST /api/projects/[id]/env-vars
 */

import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environmentVariables, projects, teamMembers } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';

type RouteParams = { params: Promise<{ id: string }> };

// ============================================
// 鉴权辅助：验证用户是否为项目所属团队成员
// ============================================

async function authorizeProjectAccess(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return { error: 'Project not found', status: 404, project: null };
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    return { error: 'Forbidden', status: 403, project: null };
  }

  return { error: null, status: 200, project };
}

// ============================================
// GET - 列出环境变量
// ============================================

export async function GET(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error, status } = await authorizeProjectAccess(projectId, session.user.id);
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(request.url);
  const environmentId = url.searchParams.get('environmentId');
  const serviceId = url.searchParams.get('serviceId');

  // 构造查询条件
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
      // 不返回加密字段
      encryptedValue: false,
      iv: false,
      authTag: false,
    },
  });

  // Secret 变量的 value 置为 null（只写不读）
  const safeVars = vars.map((v) => ({
    ...v,
    value: v.isSecret ? null : v.value,
  }));

  return NextResponse.json(safeVars);
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
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error, status } = await authorizeProjectAccess(projectId, session.user.id);
  if (error) return NextResponse.json({ error }, { status });

  let body: z.infer<typeof createEnvVarSchema>;
  try {
    body = createEnvVarSchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body', details: e }, { status: 400 });
  }

  const { key, value, isSecret, environmentId = null, serviceId = null } = body;

  // 检查同一作用域内是否已有同名变量
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

  // 加密 or 明文存储
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
    const { encryptedValue, iv, authTag } = await encrypt(value);
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

  // 立即同步到 K8s（environmentId 存在时）
  if (environmentId) {
    await syncEnvVarsToK8s(projectId, environmentId).catch((e) => {
      // 同步失败不影响 API 响应，记录日志即可
      console.error('Failed to sync env vars to K8s after create', e);
    });
  }

  return NextResponse.json(created, { status: 201 });
}
