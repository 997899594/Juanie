import { CodeReviewService } from '@juanie/service-extensions'
import { aiModelSchema } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * AI 代码审查 Router (增强版)
 * 提供代码审查相关的 API，支持多种 AI 提供商
 */
@Injectable()
export class AICodeReviewRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly codeReviewService: CodeReviewService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 全面代码审查
       * 支持多种 AI 提供商和模型
       */
      comprehensive: this.trpc.protectedProcedure
        .input(
          z.object({
            code: z.string().min(1, 'Code cannot be empty'),
            language: z.enum([
              'typescript',
              'javascript',
              'python',
              'java',
              'go',
              'rust',
              'cpp',
              'csharp',
              'php',
              'ruby',
              'swift',
              'kotlin',
              'vue',
              'react',
              'sql',
              'html',
              'css',
              'yaml',
              'json',
              'markdown',
            ]),
            fileName: z.string().optional(),
            model: aiModelSchema.optional(),
            context: z
              .object({
                projectId: z.string().optional(),
                projectType: z.string().optional(),
                framework: z.string().optional(),
                relatedFiles: z.array(z.string()).optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ input }) => {
          return this.codeReviewService.comprehensiveReview({
            ...input,
            model: input.model as any,
          })
        }),

      /**
       * 快速代码审查（仅关键问题）
       */
      quick: this.trpc.protectedProcedure
        .input(
          z.object({
            code: z.string().min(1),
            language: z.enum([
              'typescript',
              'javascript',
              'python',
              'java',
              'go',
              'rust',
              'cpp',
              'csharp',
              'php',
              'ruby',
              'swift',
              'kotlin',
              'vue',
              'react',
              'sql',
              'html',
              'css',
              'yaml',
              'json',
              'markdown',
            ]),
            fileName: z.string().optional(),
            model: aiModelSchema.optional(),
            context: z
              .object({
                projectId: z.string().optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ input }) => {
          return this.codeReviewService.quickReview({
            ...input,
            model: input.model as any,
          })
        }),

      /**
       * 安全聚焦审查
       */
      security: this.trpc.protectedProcedure
        .input(
          z.object({
            code: z.string().min(1),
            language: z.enum([
              'typescript',
              'javascript',
              'python',
              'java',
              'go',
              'rust',
              'cpp',
              'csharp',
              'php',
              'ruby',
              'swift',
              'kotlin',
              'vue',
              'react',
              'sql',
              'html',
              'css',
              'yaml',
              'json',
              'markdown',
            ]),
            fileName: z.string().optional(),
            model: aiModelSchema.optional(),
            context: z
              .object({
                projectId: z.string().optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ input }) => {
          return this.codeReviewService.securityFocusedReview({
            ...input,
            model: input.model as any,
          })
        }),

      /**
       * 批量代码审查
       */
      batch: this.trpc.protectedProcedure
        .input(
          z.object({
            files: z
              .array(
                z.object({
                  path: z.string(),
                  code: z.string().min(1),
                  language: z.enum([
                    'typescript',
                    'javascript',
                    'python',
                    'java',
                    'go',
                    'rust',
                    'cpp',
                    'csharp',
                    'php',
                    'ruby',
                    'swift',
                    'kotlin',
                    'vue',
                    'react',
                    'sql',
                    'html',
                    'css',
                    'yaml',
                    'json',
                    'markdown',
                  ]),
                }),
              )
              .min(1, 'At least one file is required')
              .max(20, 'Maximum 20 files allowed'),
            mode: z.enum(['comprehensive', 'quick', 'security-focused']).optional(),
            model: aiModelSchema.optional(),
          }),
        )
        .mutation(async ({ input }) => {
          return this.codeReviewService.batchReview(input)
        }),
    })
  }
}
