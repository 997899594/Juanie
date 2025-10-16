import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../../../lib/trpc/procedures'

// 通用错误处理函数
const handleTRPCError = (fn: () => Promise<any>) => {
  return fn().catch((error) => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      cause: error,
    })
  })
}

// 输入验证 schemas
const createBranchSchema = z.object({
  repositoryId: z.string().cuid2(),
  branchName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9\-_/]+$/),
  sourceBranch: z.string().optional().default('main'),
})

const deleteBranchSchema = z.object({
  repositoryId: z.string().cuid2(),
  branchName: z.string().min(1),
})

const createMergeRequestSchema = z.object({
  repositoryId: z.string().cuid2(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  sourceBranch: z.string().min(1),
  targetBranch: z.string().min(1),
  assigneeId: z.string().cuid2().optional(),
  reviewerIds: z.array(z.string().cuid2()).optional(),
  labels: z.array(z.string()).optional(),
})

const connectRepositorySchema = z.object({
  projectId: z.string().cuid2(),
  provider: z.enum(['GITHUB', 'GITLAB', 'GITEA', 'BITBUCKET']),
  repoUrl: z.string().url(),
  accessToken: z.string().min(1),
})

const setupWebhookSchema = z.object({
  repositoryId: z.string().cuid2(),
  webhookUrl: z.string().url(),
})

export const gitRouter = router({
  // Git 分支管理
  branches: router({
    create: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/branches',
          tags: ['Git Branches'],
          summary: '创建分支',
          description: '在指定仓库中创建新分支',
          protect: true,
        },
      })
      .input(createBranchSchema)
      .output(
        z.object({
          id: z.string(),
          name: z.string(),
          commit: z.string(),
          protected: z.boolean(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          const branch = await ctx.gitService.branches.createBranch(
            input.repositoryId,
            input.branchName,
            input.sourceBranch,
            ctx.user.id,
          )
          return {
            id: branch.id,
            name: branch.name,
            commit: branch.sha,
            protected: branch.isProtected,
          }
        })
      }),

    delete: protectedProcedure
      .meta({
        openapi: {
          method: 'DELETE',
          path: '/git/branches/{repositoryId}/{branchName}',
          tags: ['Git Branches'],
          summary: '删除分支',
          description: '删除指定仓库中的分支',
          protect: true,
        },
      })
      .input(deleteBranchSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.branches.deleteBranch(input.repositoryId, input.branchName)
          return { success: true }
        })
      }),

    list: protectedProcedure
      .meta({
        openapi: {
          method: 'GET',
          path: '/git/branches/{repositoryId}',
          tags: ['Git Branches'],
          summary: '获取分支列表',
          description: '获取指定仓库的所有分支',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(
        z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            commit: z.string(),
            protected: z.boolean(),
          }),
        ),
      )
      .query(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          return await ctx.gitService.branches.getBranches(input.repositoryId)
        })
      }),

    sync: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/branches/{repositoryId}/sync',
          tags: ['Git Branches'],
          summary: '同步分支',
          description: '同步指定仓库的分支信息',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(
        z.object({
          synced: z.number(),
          errors: z.array(z.string()),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          return await ctx.gitService.branches.syncBranches(input.repositoryId)
        })
      }),
  }),

  // Git 合并请求管理
  mergeRequests: router({
    create: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/merge-requests',
          tags: ['Git Merge Requests'],
          summary: '创建合并请求',
          description: '在指定仓库中创建新的合并请求',
          protect: true,
        },
      })
      .input(createMergeRequestSchema)
      .output(
        z.object({
          id: z.number(),
          title: z.string(),
          description: z.string().optional(),
          status: z.enum(['OPEN', 'MERGED', 'CLOSED', 'DRAFT']),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          const mr = await ctx.gitService.mergeRequests.createMergeRequest(input, ctx.user.id)
          return {
            id: mr.id,
            title: mr.title,
            description: mr.description,
            status: mr.status,
          }
        })
      }),

    list: protectedProcedure
      .meta({
        openapi: {
          method: 'GET',
          path: '/git/merge-requests/{repositoryId}',
          tags: ['Git Merge Requests'],
          summary: '获取合并请求列表',
          description: '获取指定仓库的合并请求列表',
          protect: true,
        },
      })
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          status: z.enum(['OPEN', 'MERGED', 'CLOSED', 'DRAFT']).optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        }),
      )
      .output(
        z.object({
          mergeRequests: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              status: z.enum(['OPEN', 'MERGED', 'CLOSED', 'DRAFT']),
              sourceBranch: z.string(),
              targetBranch: z.string(),
            }),
          ),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      )
      .query(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          const result = await ctx.gitService.mergeRequests.getMergeRequests({
            repositoryId: input.repositoryId,
            status: input.status,
            page: input.page,
            limit: input.limit,
          })
          return {
            mergeRequests: result.mergeRequests.map((mr) => ({
              id: mr.mrId,
              title: mr.title,
              status: mr.status,
              sourceBranch: mr.sourceBranch,
              targetBranch: mr.targetBranch,
            })),
            total: result.total,
            page: result.page,
            limit: result.limit,
          }
        })
      }),

    merge: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/merge-requests/{repositoryId}/{mrId}/merge',
          tags: ['Git Merge Requests'],
          summary: '合并请求',
          description: '合并指定的合并请求',
          protect: true,
        },
      })
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          mrId: z.number(),
        }),
      )
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.mergeRequests.mergeMergeRequest(
            input.repositoryId,
            input.mrId,
            ctx.user.id,
          )
          return { success: true }
        })
      }),

    close: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/merge-requests/{repositoryId}/{mrId}/close',
          tags: ['Git Merge Requests'],
          summary: '关闭合并请求',
          description: '关闭指定的合并请求',
          protect: true,
        },
      })
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          mrId: z.number(),
        }),
      )
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.mergeRequests.closeMergeRequest(input.repositoryId, input.mrId)
          return { success: true }
        })
      }),

    sync: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/merge-requests/{repositoryId}/sync',
          tags: ['Git Merge Requests'],
          summary: '同步合并请求',
          description: '同步指定仓库的合并请求',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(
        z.object({
          synced: z.number(),
          errors: z.array(z.string()),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          return await ctx.gitService.mergeRequests.syncMergeRequests(input.repositoryId)
        })
      }),
  }),

  // Git 仓库管理
  repositories: router({
    list: protectedProcedure
      .meta({
        openapi: {
          method: 'GET',
          path: '/git/repositories',
          tags: ['Git Repositories'],
          summary: '获取仓库列表',
          description: '获取用户的仓库列表',
          protect: true,
        },
      })
      .input(
        z.object({
          projectId: z.string().cuid2().optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        }),
      )
      .output(
        z.object({
          repositories: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              fullName: z.string(),
              provider: z.enum(['GITHUB', 'GITLAB', 'GITEA', 'BITBUCKET']),
              isPrivate: z.boolean(),
              defaultBranch: z.string(),
              webUrl: z.string(),
            }),
          ),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      )
      .query(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          const result = await ctx.gitService.repositories.getRepositories(
            {
              projectId: input.projectId,
              page: input.page,
              limit: input.limit,
            },
            ctx.user.id,
          )

          return {
            repositories: result.repositories.map((repo) => ({
              id: repo.id,
              name: repo.repoName,
              fullName: repo.repoName, // 使用 repoName 作为 fullName
              provider: repo.provider,
              isPrivate: false, // 添加默认值，实际应该从 provider 获取
              defaultBranch: repo.defaultBranch,
              webUrl: repo.repoUrl, // 使用 repoUrl 作为 webUrl
            })),
            total: result.total,
            page: result.page,
            limit: result.limit,
          }
        })
      }),

    connect: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/repositories/connect',
          tags: ['Git Repositories'],
          summary: '连接仓库',
          description: '连接外部 Git 仓库到项目',
          protect: true,
        },
      })
      .input(connectRepositorySchema)
      .output(
        z.object({
          id: z.string(),
          name: z.string(),
          fullName: z.string(),
          provider: z.enum(['GITHUB', 'GITLAB', 'GITEA', 'BITBUCKET']),
          connected: z.boolean(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          const repo = await ctx.gitService.repositories.connectRepository(input, ctx.user.id)
          return {
            id: repo.id,
            name: repo.repoName,
            fullName: repo.repoName, // 使用 repoName 作为 fullName
            provider: repo.provider,
            connected: true,
          }
        })
      }),

    sync: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/repositories/{repositoryId}/sync',
          tags: ['Git Repositories'],
          summary: '同步仓库',
          description: '同步指定仓库的信息',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.repositories.syncRepository(input.repositoryId)
          return { success: true }
        })
      }),

    disconnect: protectedProcedure
      .meta({
        openapi: {
          method: 'DELETE',
          path: '/git/repositories/{repositoryId}',
          tags: ['Git Repositories'],
          summary: '断开仓库连接',
          description: '断开指定仓库的连接',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.repositories.disconnectRepository(input.repositoryId)
          return { success: true }
        })
      }),
  }),

  // Git Webhook 管理
  webhooks: router({
    setup: protectedProcedure
      .meta({
        openapi: {
          method: 'POST',
          path: '/git/webhooks/setup',
          tags: ['Git Webhooks'],
          summary: '设置 Webhook',
          description: '为指定仓库设置 Webhook',
          protect: true,
        },
      })
      .input(setupWebhookSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.webhooks.setupWebhook(input.repositoryId, input.webhookUrl)
          return { success: true }
        })
      }),

    remove: protectedProcedure
      .meta({
        openapi: {
          method: 'DELETE',
          path: '/git/webhooks/{repositoryId}',
          tags: ['Git Webhooks'],
          summary: '移除 Webhook',
          description: '移除指定仓库的 Webhook',
          protect: true,
        },
      })
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        return handleTRPCError(async () => {
          await ctx.gitService.webhooks.removeWebhook(input.repositoryId)
          return { success: true }
        })
      }),
  }),
})
