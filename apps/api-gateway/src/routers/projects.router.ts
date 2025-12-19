import { handleServiceError } from '@juanie/core/errors'
import { REDIS } from '@juanie/core/tokens'
import {
  InitializationStepsService,
  ProjectMembersService,
  ProjectStatusService,
  ProjectsService,
} from '@juanie/service-business'
import { StorageService } from '@juanie/service-foundation'
import {
  archiveProjectSchema,
  createProjectSchema,
  deleteProjectSchema,
  getProjectHealthSchema,
  getProjectStatusSchema,
  organizationIdQuerySchema,
  projectIdSchema,
  restoreProjectSchema,
  updateProjectSchema,
} from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import type Redis from 'ioredis'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsService: ProjectsService,
    private readonly projectMembers: ProjectMembersService,
    private readonly projectStatus: ProjectStatusService,
    private readonly initializationSteps: InitializationStepsService,
    private readonly storageService: StorageService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  get router() {
    return this.trpc.router({
      // 创建项目（统一接口，支持简单创建、模板创建和仓库创建）
      create: this.trpc.protectedProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.projectsService.create(ctx.user.id, input)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 列出组织的项目
      list: this.trpc.protectedProcedure
        .input(organizationIdQuerySchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.projectsService.list(ctx.user.id, input.organizationId)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 获取项目详情
      get: this.trpc.protectedProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
        try {
          return await this.projectsService.get(ctx.user.id, input.projectId)
        } catch (error) {
          handleServiceError(error)
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
            handleServiceError(error)
          }
        }),

      // 删除项目
      delete: this.trpc.protectedProcedure
        .input(deleteProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.projectsService.delete(ctx.user.id, input.projectId, {
              repositoryAction: input.repositoryAction,
            })
          } catch (error) {
            handleServiceError(error)
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
            const { projectId, memberId, role, ...rest } = input
            // 映射 'developer' 到 'member'
            const mappedRole = (role === 'developer' ? 'member' : role) as
              | 'owner'
              | 'admin'
              | 'member'
              | 'viewer'
            const data = { userId: memberId, role: mappedRole, ...rest }
            return await this.projectMembers.addMember(ctx.user.id, projectId, data)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 列出项目成员
      listMembers: this.trpc.protectedProcedure.input(projectIdSchema).query(async ({ input }) => {
        try {
          return await this.projectMembers.listMembers(input.projectId)
        } catch (error) {
          handleServiceError(error)
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
            const { projectId, memberId, role, ...rest } = input
            // 映射 'developer' 到 'member'
            const mappedRole = (role === 'developer' ? 'member' : role) as
              | 'owner'
              | 'admin'
              | 'member'
              | 'viewer'
            const data = { userId: memberId, role: mappedRole, ...rest }
            return await this.projectMembers.updateMemberRole(ctx.user.id, projectId, data)
          } catch (error) {
            handleServiceError(error)
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
            const { projectId, memberId, ...rest } = input
            const data = { userId: memberId, ...rest }
            return await this.projectMembers.removeMember(ctx.user.id, projectId, data)
          } catch (error) {
            handleServiceError(error)
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
            return await this.projectMembers.assignTeam(ctx.user.id, projectId, data)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 列出项目的团队
      listTeams: this.trpc.protectedProcedure.input(projectIdSchema).query(async ({ input }) => {
        try {
          return await this.projectMembers.listTeams(input.projectId)
        } catch (error) {
          handleServiceError(error)
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
            return await this.projectMembers.removeTeam(ctx.user.id, projectId, data)
          } catch (error) {
            handleServiceError(error)
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

      // 获取项目完整状态
      getStatus: this.trpc.protectedProcedure
        .input(getProjectStatusSchema)
        .query(async ({ input }) => {
          try {
            return await this.projectStatus.getStatus(input.projectId)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 获取项目健康度
      getHealth: this.trpc.protectedProcedure
        .input(getProjectHealthSchema)
        .query(async ({ input }) => {
          try {
            return await this.projectStatus.getHealth(input.projectId)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 归档项目
      archive: this.trpc.protectedProcedure
        .input(archiveProjectSchema)
        .mutation(async ({ input }) => {
          try {
            return await this.projectStatus.archive(input.projectId)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 恢复项目
      restore: this.trpc.protectedProcedure
        .input(restoreProjectSchema)
        .mutation(async ({ input }) => {
          try {
            return await this.projectStatus.restore(input.projectId)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      // 订阅项目初始化进度（SSE 实现）
      onInitProgress: this.trpc.procedure
        .input(z.object({ projectId: z.string() }))
        .subscription(({ input }) => {
          return observable<any>((emit) => {
            const subscriber = this.redis.duplicate()
            const channel = `project:${input.projectId}`

            subscriber.subscribe(channel)

            subscriber.on('message', async (_channel, message) => {
              try {
                const event = JSON.parse(message)

                // 查询当前所有步骤
                const steps = await this.initializationSteps.getProjectSteps(input.projectId)

                // 发送事件和步骤数组
                emit.next({
                  ...event,
                  steps: steps.map((step) => ({
                    step: step.step,
                    status: step.status,
                    progress: step.progress,
                    error: step.error,
                    startedAt: step.startedAt,
                    completedAt: step.completedAt,
                    duration:
                      step.startedAt && step.completedAt
                        ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
                        : null,
                  })),
                })

                // 如果完成或失败，自动关闭连接
                if (
                  event.type === 'initialization.completed' ||
                  event.type === 'initialization.failed'
                ) {
                  emit.complete()
                }
              } catch (error) {
                console.error('Failed to parse event:', error)
              }
            })

            subscriber.on('error', (error) => {
              console.error('Redis subscription error:', error)
              emit.error(error)
            })

            // 清理函数
            return () => {
              subscriber.unsubscribe(channel)
              subscriber.quit()
            }
          })
        }),

      // 获取最近活动
      getRecentActivities: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string(), limit: z.number().optional() }))
        .query(async ({ input: _input }) => {
          // TODO: 实现获取最近活动的逻辑
          return {
            activities: [] as Array<{
              id: string
              type: 'deployment' | 'environment' | 'member' | 'settings'
              title: string
              description: string
              status: 'success' | 'failed' | 'pending' | 'running'
              createdAt: string
            }>,
          }
        }),

      // 更新部署设置
      updateDeploySettings: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            settings: z.object({
              autoDeployEnabled: z.boolean().optional(),
              deployBranch: z.string().optional(),
            }),
          }),
        )
        .mutation(async ({ input: _input }) => {
          // TODO: 实现更新部署设置的逻辑
          return { success: true }
        }),

      // 成员管理（嵌套 router）
      members: this.trpc.router({
        list: this.trpc.protectedProcedure
          .input(z.object({ projectId: z.string() }))
          .query(async ({ input: _input }) => {
            return await this.projectMembers.listMembers(_input.projectId)
          }),

        add: this.trpc.protectedProcedure
          .input(
            z.object({
              projectId: z.string(),
              memberId: z.string(),
              role: z.enum(['admin', 'developer', 'viewer']),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            const { projectId, memberId, role, ...rest } = input
            // 映射 'developer' 到 'member'
            const mappedRole = (role === 'developer' ? 'member' : role) as
              | 'owner'
              | 'admin'
              | 'member'
              | 'viewer'
            const data = { userId: memberId, role: mappedRole, ...rest }
            return await this.projectMembers.addMember(ctx.user.id, projectId, data)
          }),

        remove: this.trpc.protectedProcedure
          .input(
            z.object({
              projectId: z.string(),
              memberId: z.string(),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            const { projectId, memberId, ...rest } = input
            const data = { userId: memberId, ...rest }
            return await this.projectMembers.removeMember(ctx.user.id, projectId, data)
          }),
      }),
    })
  }
}
