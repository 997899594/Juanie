/**
 * 示例: 使用新的 API 工具重构 projects endpoint
 *
 * 这是一个示例文件，展示如何使用新的中间件和工具
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createApiHandler,
  withApiMiddleware,
  requireAuth,
  requireTeamMember,
  withValidation,
  withQueryValidation,
  createRateLimiterFromPreset,
  NotFoundError,
  withApiHandler,
} from '@/lib/api/middleware';
import { createProjectSchema, paginationSchema, updateProjectSchema } from '@/lib/api/validation';
import { db } from '@/lib/db';
import { projects, teams, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================
// Rate Limiter
// ============================================

const projectRateLimiter = createRateLimiterFromPreset('medium');

// ============================================
// GET /api/projects - List user's projects
// ============================================

export const GET = createApiHandler(
  async (input, context) => {
    const { page, limit } = input;
    const { userId } = context.auth!;

    const userProjects = await db
      .select({
        project: projects,
        teamName: teams.name,
      })
      .from(projects)
      .innerJoin(teams, eq(teams.id, projects.teamId))
      .innerJoin(
        teamMembers,
        and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId))
      )
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: userProjects,
      pagination: {
        page,
        limit,
        total: userProjects.length,
      },
    };
  },
  {
    input: paginationSchema,
    requireAuth: true,
    rateLimiter: projectRateLimiter,
    logRequest: true,
  }
);

// ============================================
// POST /api/projects - Create a new project
// ============================================

export const POST = createApiHandler(
  async (input, context) => {
    const { userId } = context.auth!;
    const { teamId, name, slug, description, services, databases, ...rest } = input;

    // 验证团队成员
    const { role } = await requireTeamMember(teamId);

    // 创建项目
    const [project] = await db
      .insert(projects)
      .values({
        ...rest,
        name,
        slug,
        description,
        teamId,
        status: 'initializing',
      })
      .returning();

    context.logger.info('Project created', { projectId: project.id });

    // 添加项目初始化任务
    const { addProjectInitJob } = await import('@/lib/queue');
    await addProjectInitJob(project.id, rest.mode || 'create');

    return project;
  },
  {
    input: createProjectSchema,
    requireAuth: true,
    rateLimiter: projectRateLimiter,
    logRequest: true,
  }
);

// ============================================
// [id] 路由示例
// ============================================

export async function GET_PROJECT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(
    async (req, { requestId, auth }) => {
      const { userId } = auth!;

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
        with: {
          team: {
            members: true,
          },
        },
      });

      if (!project) {
        throw new NotFoundError('project', `Project ${params.id} not found`);
      }

      // 验证权限
      const isMember = project.team.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new NotFoundError('project');
      }

      return project;
    },
    { requireAuth: true }
  );
}

export async function PATCH_PROJECT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(
    async (req, { requestId, auth }) => {
      const { userId } = auth!;
      const body = await req.json();
      const data = updateProjectSchema.parse(body);

      // 验证权限
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
        with: { team: { members: true } },
      });

      if (!project) {
        throw new NotFoundError('project');
      }

      const member = project.team.members.find((m) => m.userId === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw new NotFoundError('project');
      }

      // 更新项目
      const [updated] = await db
        .update(projects)
        .set(data)
        .where(eq(projects.id, params.id))
        .returning();

      return updated;
    },
    { requireAuth: true }
  );
}

export async function DELETE_PROJECT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiHandler(
    async (req, { requestId, auth }) => {
      const { userId } = auth!;

      // 验证权限（只有 owner 可以删除）
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, params.id),
        with: { team: { members: true } },
      });

      if (!project) {
        throw new NotFoundError('project');
      }

      const member = project.team.members.find((m) => m.userId === userId);
      if (!member || member.role !== 'owner') {
        throw new NotFoundError('project');
      }

      // 删除项目
      await db.delete(projects).where(eq(projects.id, params.id));

      return { success: true };
    },
    { requireAuth: true }
  );
}
