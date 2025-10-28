import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RoleAssignmentsService } from './role-assignments.service';
import { z } from 'zod';
import { 
  insertRoleAssignmentSchema, 
  updateRoleAssignmentSchema,
  selectRoleAssignmentSchema 
} from '../../database/schemas/role-assignments.schema';

// 输入验证 schemas
const createRoleAssignmentInputSchema = insertRoleAssignmentSchema;

const getRoleAssignmentsInputSchema = z.object({
  roleId: z.string().optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  resourceType: z.enum(['organization', 'project', 'team', 'global']).optional(),
  includeExpired: z.boolean().default(false),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

const updateRoleAssignmentInputSchema = z.object({
  id: z.string(),
  data: updateRoleAssignmentSchema
});

const deleteRoleAssignmentInputSchema = z.object({
  id: z.string()
});

const checkPermissionInputSchema = z.object({
  userId: z.string(),
  permission: z.string(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  resourceType: z.enum(['organization', 'project', 'team', 'global']).optional(),
  resourceId: z.string().optional()
});

const deleteUserRoleAssignmentsInputSchema = z.object({
  userId: z.string(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  roleIds: z.array(z.string()).optional()
});

@Injectable()
export class RoleAssignmentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly roleAssignmentsService: RoleAssignmentsService,
  ) {}

  public get roleAssignmentsRouter() {
    return this.trpc.router({
      // 获取角色分配列表
      getRoleAssignments: this.trpc.publicProcedure
        .input(getRoleAssignmentsInputSchema)
        .query(async ({ input }) => {
          if (input.userId) {
            return await this.roleAssignmentsService.getUserRoleAssignments({
              userId: input.userId,
              organizationId: input.organizationId,
              projectId: input.projectId,
              teamId: input.teamId,
              resourceType: input.resourceType,
              includeExpired: input.includeExpired,
              page: input.page,
              limit: input.limit
            });
          } else if (input.roleId) {
            return await this.roleAssignmentsService.getRoleAssignments({
              roleId: input.roleId,
              organizationId: input.organizationId,
              projectId: input.projectId,
              teamId: input.teamId,
              includeExpired: input.includeExpired,
              page: input.page,
              limit: input.limit
            });
          } else {
            throw new Error('Either userId or roleId must be provided');
          }
        }),

      // 根据ID获取角色分配
      getRoleAssignmentById: this.trpc.publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
          return await this.roleAssignmentsService.findById(input.id);
        }),

      // 创建角色分配
      createRoleAssignment: this.trpc.publicProcedure
        .input(createRoleAssignmentInputSchema)
        .mutation(async ({ input }) => {
          return await this.roleAssignmentsService.createRoleAssignment(input);
        }),

      // 更新角色分配
      updateRoleAssignment: this.trpc.publicProcedure
        .input(updateRoleAssignmentInputSchema)
        .mutation(async ({ input }) => {
          return await this.roleAssignmentsService.updateRoleAssignment(input.id, input.data);
        }),

      // 删除角色分配
      deleteRoleAssignment: this.trpc.publicProcedure
        .input(deleteRoleAssignmentInputSchema)
        .mutation(async ({ input }) => {
          await this.roleAssignmentsService.deleteRoleAssignment(input.id);
          return { success: true };
        }),

      // 批量删除用户的角色分配
      deleteUserRoleAssignments: this.trpc.publicProcedure
        .input(deleteUserRoleAssignmentsInputSchema)
        .mutation(async ({ input }) => {
          await this.roleAssignmentsService.deleteUserRoleAssignments(input.userId, {
            organizationId: input.organizationId,
            projectId: input.projectId,
            teamId: input.teamId,
            roleIds: input.roleIds
          });
          return { success: true };
        }),

      // 检查用户权限
      checkUserPermission: this.trpc.publicProcedure
        .input(checkPermissionInputSchema)
        .query(async ({ input }) => {
          const hasPermission = await this.roleAssignmentsService.checkUserPermission(
            input.userId,
            input.permission,
            {
              organizationId: input.organizationId,
              projectId: input.projectId,
              teamId: input.teamId,
              resourceType: input.resourceType,
              resourceId: input.resourceId
            }
          );
          return { hasPermission };
        }),

      // 获取用户的所有角色分配
      getUserRoleAssignments: this.trpc.publicProcedure
        .input(z.object({
          userId: z.string(),
          organizationId: z.string().optional(),
          projectId: z.string().optional(),
          teamId: z.string().optional(),
          resourceType: z.enum(['organization', 'project', 'team', 'global']).optional(),
          includeExpired: z.boolean().default(false),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20)
        }))
        .query(async ({ input }) => {
          return await this.roleAssignmentsService.getUserRoleAssignments(input);
        }),

      // 获取角色的所有分配情况
      getRoleAssignmentsByRole: this.trpc.publicProcedure
        .input(z.object({
          roleId: z.string(),
          organizationId: z.string().optional(),
          projectId: z.string().optional(),
          teamId: z.string().optional(),
          includeExpired: z.boolean().default(false),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20)
        }))
        .query(async ({ input }) => {
          return await this.roleAssignmentsService.getRoleAssignments(input);
        }),

      // 保留原有的 hello 方法
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.roleAssignmentsService.hello();
        }),
    });
  }
}