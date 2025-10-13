import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../../../trpc/init'

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
  provider: z.enum(['GITHUB', 'GITLAB', 'GITEA']),
  repoUrl: z.string().url(),
  accessToken: z.string().min(1),
})

const setupWebhookSchema = z.object({
  repositoryId: z.string().cuid2(),
  webhookUrl: z.string().url(),
})

export const gitRouter = router({
  // 分支管理
  branches: router({
    create: protectedProcedure.input(createBranchSchema).mutation(async ({ input, ctx }) => {
      try {
        return await ctx.gitService.branches.createBranch(
          input.repositoryId,
          input.branchName,
          input.sourceBranch,
          ctx.user.id,
        )
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
      }
    }),

    delete: protectedProcedure.input(deleteBranchSchema).mutation(async ({ input, ctx }) => {
      try {
        await ctx.gitService.branches.deleteBranch(input.repositoryId, input.branchName)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
      }
    }),

    list: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .query(async ({ input, ctx }) => {
        return await ctx.gitService.branches.getBranches(input.repositoryId)
      }),

    sync: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await ctx.gitService.branches.syncBranches(input.repositoryId)
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),
  }),

  // 合并请求管理
  mergeRequests: router({
    create: protectedProcedure.input(createMergeRequestSchema).mutation(async ({ input, ctx }) => {
      try {
        return await ctx.gitService.mergeRequests.createMergeRequest(input, ctx.user.id)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
      }
    }),

    list: protectedProcedure
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          status: z.enum(['OPEN', 'MERGED', 'CLOSED', 'DRAFT']).optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input, ctx }) => {
        return await ctx.gitService.mergeRequests.getMergeRequests(input)
      }),

    merge: protectedProcedure
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          mrId: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          await ctx.gitService.mergeRequests.mergeMergeRequest(
            input.repositoryId,
            input.mrId,
            ctx.user.id,
          )
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),

    close: protectedProcedure
      .input(
        z.object({
          repositoryId: z.string().cuid2(),
          mrId: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          await ctx.gitService.mergeRequests.closeMergeRequest(input.repositoryId, input.mrId)
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),

    sync: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await ctx.gitService.mergeRequests.syncMergeRequests(input.repositoryId)
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),
  }),

  // 仓库管理
  repositories: router({
    list: protectedProcedure
      .input(
        z.object({
          projectId: z.string().cuid2().optional(),
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input, ctx }) => {
        return await ctx.gitService.repositories.getRepositories(input, ctx.user.id)
      }),

    connect: protectedProcedure.input(connectRepositorySchema).mutation(async ({ input, ctx }) => {
      try {
        return await ctx.gitService.repositories.connectRepository(input, ctx.user.id)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
      }
    }),

    sync: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await ctx.gitService.repositories.syncRepository(input.repositoryId)
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),

    disconnect: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await ctx.gitService.repositories.disconnectRepository(input.repositoryId)
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),
  }),

  // Webhook 管理
  webhooks: router({
    setup: protectedProcedure.input(setupWebhookSchema).mutation(async ({ input, ctx }) => {
      try {
        await ctx.gitService.webhooks.setupWebhook(input.repositoryId, input.webhookUrl)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        })
      }
    }),

    remove: protectedProcedure
      .input(z.object({ repositoryId: z.string().cuid2() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await ctx.gitService.webhooks.removeWebhook(input.repositoryId)
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          })
        }
      }),
  }),
})
