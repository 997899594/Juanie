import {
  addProjectMemberSchema,
  assignTeamToProjectSchema,
  createProjectSchema,
  organizationIdQuerySchema,
  projectIdSchema,
  removeProjectMemberSchema,
  removeTeamFromProjectSchema,
  updateProjectMemberRoleSchema,
  updateProjectSchema,
  uploadLogoSchema,
} from '@juanie/core-types'
import { ProjectsService } from '@juanie/service-projects'
import { StorageService } from '@juanie/service-storage'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsService: ProjectsService,
    private readonly storageService: StorageService,
  ) {}

  get router() {
    return this.trpc.router({
      // 创建项目
      create: this.trpc.protectedProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.projectsService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建项目失败',
            })
          }
        }),

      // 列出组织的项目
      list: this.trpc.protectedProcedure
        .input(organizationIdQuerySchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.projectsService.list(ctx.user.id, input.organizationId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取项目列表失败',
            })
          }
        }),

      // 获取项目详情
      get: this.trpc.protectedProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
        try {
          const project = await this.projectsService.get(ctx.user.id, input.projectId)

          if (!project) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '项目不存在',
            })
          }

          return project
        } catch (error) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error instanceof Error ? error.message : '获取项目详情失败',
          })
        }
      }),

      // 更新项目
      update: this.trpc.protectedProcedure
        .input(updateProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.update(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新项目失败',
            })
          }
        }),

      // 删除项目
      delete: this.trpc.protectedProcedure
        .input(projectIdSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.projectsService.delete(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '删除项目失败',
            })
          }
        }),

      // 添加成员
      addMember: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            memberId: z.string(),
            role: z.enum(['admin', 'developer', 'viewer']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.addMember(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '添加成员失败',
            })
          }
        }),

      // 列出项目成员
      listMembers: this.trpc.protectedProcedure
        .input(projectIdSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.projectsService.listMembers(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取成员列表失败',
            })
          }
        }),

      // 更新成员角色
      updateMemberRole: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            memberId: z.string(),
            role: z.enum(['admin', 'developer', 'viewer']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.updateMemberRole(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新成员角色失败',
            })
          }
        }),

      // 移除成员
      removeMember: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            memberId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.removeMember(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '移除成员失败',
            })
          }
        }),

      // 分配团队
      assignTeam: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            teamId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.assignTeam(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '分配团队失败',
            })
          }
        }),

      // 列出项目的团队
      listTeams: this.trpc.protectedProcedure
        .input(projectIdSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.projectsService.listTeams(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取团队列表失败',
            })
          }
        }),

      // 移除团队
      removeTeam: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            teamId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, ...data } = input
            return await this.projectsService.removeTeam(ctx.user.id, projectId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '移除团队失败',
            })
          }
        }),

      // 上传项目 Logo
      uploadLogo: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            file: z.string(), // Base64 编码的图片
            contentType: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 验证图片类型
            if (!this.storageService.isValidImageType(input.contentType)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: '不支持的图片格式，请上传 JPG, PNG, GIF, WebP 或 SVG',
              })
            }

            // 解码 Base64
            const buffer = Buffer.from(input.file, 'base64')

            // 验证文件大小（5MB）
            if (!this.storageService.isValidFileSize(buffer.length)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: '文件大小超过限制（最大 5MB）',
              })
            }

            // 上传到 MinIO
            const logoUrl = await this.storageService.uploadProjectLogo(
              input.projectId,
              buffer,
              input.contentType,
            )

            // 更新项目
            const project = await this.projectsService.uploadLogo(
              ctx.user.id,
              input.projectId,
              logoUrl,
            )

            return {
              success: true,
              logoUrl,
              project,
            }
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '上传 Logo 失败',
            })
          }
        }),

      // 删除项目 Logo
      deleteLogo: this.trpc.protectedProcedure
        .input(projectIdSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            // 删除 MinIO 中的文件
            await this.storageService.deleteProjectLogo(input.projectId)

            // 更新项目（清空 logoUrl）
            const project = await this.projectsService.uploadLogo(
              ctx.user.id,
              input.projectId,
              null,
            )

            return {
              success: true,
              project,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '删除 Logo 失败',
            })
          }
        }),
    })
  }
}
