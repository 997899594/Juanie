import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { ProjectsService } from './projects.service';
import { z } from 'zod';
import { 
  insertProjectSchema, 
  updateProjectSchema, 
  selectProjectSchema,
  ProjectStatusEnum,
  ProjectVisibilityEnum 
} from '../../database/schemas/projects.schema';

@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsService: ProjectsService,
  ) {}

  public get projectsRouter() {
    return this.trpc.router({
      // 健康检查
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return `Hello from Projects module ${input?.name ?? 'world'}`;
        }),

      // 创建项目
      create: this.trpc.organizationProcedure
        .input(insertProjectSchema.omit({ 
          id: true, 
          createdAt: true, 
          updatedAt: true,
          currentComputeUnits: true,
          currentStorageGb: true,
          currentMonthlyCost: true,
        }))
        .output(selectProjectSchema)
        .mutation(async ({ input, ctx }) => {
          return await this.projectsService.createProject(input);
        }),

      // 根据ID获取项目
      getById: this.trpc.organizationProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectProjectSchema.nullable())
        .query(async ({ input }) => {
          return await this.projectsService.findById(input.id);
        }),

      // 根据Slug获取项目
      getBySlug: this.trpc.organizationProcedure
        .input(z.object({ 
          organizationId: z.string().uuid(),
          slug: z.string()
        }))
        .output(selectProjectSchema.nullable())
        .query(async ({ input }) => {
          return await this.projectsService.findBySlug(input.slug);
        }),

      // 更新项目
      update: this.trpc.organizationProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateProjectSchema
        }))
        .output(selectProjectSchema)
        .mutation(async ({ input }) => {
          return await this.projectsService.updateProject(input.id, input.data);
        }),

      // 删除项目
      delete: this.trpc.organizationProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          await this.projectsService.deleteProject(input.id);
          return { success: true };
        }),

      // 获取组织的项目列表
      getOrganizationProjects: this.trpc.organizationProcedure
        .input(z.object({
          organizationId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: ProjectStatusEnum.optional(),
          visibility: ProjectVisibilityEnum.optional(),
          search: z.string().optional(),
          sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
          sortOrder: z.enum(['asc', 'desc']).default('desc')
        }))
        .output(z.object({
          projects: z.array(selectProjectSchema),
          total: z.number(),
          limit: z.number(),
          offset: z.number()
        }))
        .query(async ({ input }) => {
          const result = await this.projectsService.getOrganizationProjects(
            input.organizationId, 
            input.limit, 
            input.offset
          );
          return {
            ...result,
            limit: input.limit,
            offset: input.offset
          };
        }),

      // 获取用户的项目列表
      getUserProjects: this.trpc.organizationProcedure
        .input(z.object({
          userId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0)
        }))
        .output(z.array(selectProjectSchema))
        .query(async ({ input }) => {
          return await this.projectsService.getUserProjects(input.userId);
        }),

      // 项目成员管理
      members: this.trpc.router({
        // 获取项目成员
        list: this.trpc.organizationProcedure
          .input(z.object({
            projectId: z.string().uuid(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0)
          }))
          .query(async ({ input }) => {
            return await this.projectsService.getProjectMembers(
              input.projectId, 
              input.limit, 
              input.offset
            );
          }),

        // 添加项目成员
        add: this.trpc.organizationProcedure
          .input(z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.enum(['guest', 'reporter', 'developer', 'maintainer', 'owner'])
          }))
          .output(z.object({ success: z.boolean() }))
          .mutation(async ({ input }) => {
            await this.projectsService.addProjectMember(
              input.projectId, 
              input.userId, 
              input.role
            );
            return { success: true };
          }),

        // 移除项目成员
        remove: this.trpc.organizationProcedure
          .input(z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid()
          }))
          .output(z.object({ success: z.boolean() }))
          .mutation(async ({ input }) => {
            await this.projectsService.removeProjectMember(input.projectId, input.userId);
            return { success: true };
          }),

        // 更新成员角色
        updateRole: this.trpc.organizationProcedure
          .input(z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            role: z.enum(['guest', 'reporter', 'developer', 'maintainer', 'owner'])
          }))
          .output(z.object({ success: z.boolean() }))
          .mutation(async ({ input }) => {
            await this.projectsService.updateProjectMemberRole(
              input.projectId, 
              input.userId, 
              input.role
            );
            return { success: true };
          }),
      }),

      // 项目资源管理
      resources: this.trpc.router({
        // 更新项目使用情况
        updateUsage: this.trpc.organizationProcedure
          .input(z.object({
            projectId: z.string().uuid(),
            usage: z.object({
              currentComputeUnits: z.number().int().min(0).optional(),
              currentStorageGb: z.number().int().min(0).optional(),
              currentMonthlyCost: z.number().min(0).optional()
            })
          }))
          .output(selectProjectSchema)
          .mutation(async ({ input }) => {
            return await this.projectsService.updateProjectUsage(input.projectId, input.usage);
          }),

        // 检查资源限制
        checkLimits: this.trpc.organizationProcedure
          .input(z.object({ projectId: z.string().uuid() }))
          .output(z.object({
            withinLimits: z.boolean(),
            violations: z.array(z.string()),
            usage: z.any(),
            limits: z.any()
          }))
          .query(async ({ input }) => {
            return await this.projectsService.checkProjectResourceLimits(input.projectId);
          }),

        // 获取项目统计
        stats: this.trpc.organizationProcedure
          .input(z.object({ projectId: z.string().uuid() }))
          .query(async ({ input }) => {
            return await this.projectsService.getProjectStats(input.projectId);
          }),
      }),

      // 项目归档管理
      archive: this.trpc.organizationProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectProjectSchema)
        .mutation(async ({ input }) => {
          return await this.projectsService.archiveProject(input.id);
        }),

      unarchive: this.trpc.organizationProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectProjectSchema)
        .mutation(async ({ input }) => {
          return await this.projectsService.unarchiveProject(input.id);
        }),
    });
  }
}