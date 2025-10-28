import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  insertRoleSchema,
  selectRoleSchema,
  updateRoleSchema,
} from "../../database/schemas/roles.schema";
import { TrpcService } from "../../trpc/trpc.service";
import { RolesService } from "./roles.service";

// 输入验证 schemas
const createRoleInputSchema = insertRoleSchema;

const getRolesInputSchema = z.object({
  organizationId: z.string().optional(),
  scope: z.enum(["global", "organization", "team", "project"]).optional(),
  isSystem: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const updateRoleInputSchema = z.object({
  id: z.string(),
  data: updateRoleSchema,
});

const deleteRoleInputSchema = z.object({
  id: z.string(),
});

const initializeSystemRolesInputSchema = z.object({
  organizationId: z.string().optional(),
});

@Injectable()
export class RolesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly rolesService: RolesService
  ) {}

  public get rolesRouter() {
    return this.trpc.router({
      // 获取角色列表
      list: this.trpc.protectedProcedure
        .input(getRolesInputSchema)
        .query(async ({ input, ctx }) => {
          try {
            return await this.rolesService.getOrganizationRoles(input);
          } catch (error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error ? error.message : "Failed to get roles",
            });
          }
        }),

      // 根据ID获取角色
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            const role = await this.rolesService.findById(input.id);

            if (!role) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Role not found",
              });
            }

            return role;
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error;
            }
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error ? error.message : "Failed to get role",
            });
          }
        }),

      // 根据slug获取角色
      getBySlug: this.trpc.protectedProcedure
        .input(
          z.object({
            slug: z.string(),
            organizationId: z.string().uuid().optional(),
          })
        )
        .query(async ({ input, ctx }) => {
          try {
            const role = await this.rolesService.findBySlug(
              input.slug,
              input.organizationId
            );

            if (!role) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Role not found",
              });
            }

            return role;
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error;
            }
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error ? error.message : "Failed to get role",
            });
          }
        }),

      // 创建角色
      create: this.trpc.protectedProcedure
        .input(createRoleInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await this.rolesService.createRole(input);
          } catch (error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to create role",
            });
          }
        }),

      // 更新角色
      update: this.trpc.protectedProcedure
        .input(updateRoleInputSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            const role = await this.rolesService.updateRole(
              input.id,
              input.data
            );

            if (!role) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Role not found",
              });
            }

            return role;
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error;
            }
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to update role",
            });
          }
        }),

      // 删除角色
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            const success = await this.rolesService.deleteRole(input.id);

            if (!success) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Role not found",
              });
            }

            return { success: true };
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error;
            }
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to delete role",
            });
          }
        }),

      // 获取系统角色
      getSystemRoles: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        try {
          return await this.rolesService.getSystemRoles();
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get system roles",
          });
        }
      }),

      // 初始化系统角色
      initializeSystemRoles: this.trpc.protectedProcedure.mutation(
        async ({ ctx }) => {
          try {
            return await this.rolesService.initializeSystemRoles();
          } catch (error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to initialize system roles",
            });
          }
        }
      ),

      // Hello endpoint for testing
      hello: this.trpc.publicProcedure.query(async ({ ctx }) => {
        return { message: "Hello from Roles!" };
      }),
    });
  }
}
