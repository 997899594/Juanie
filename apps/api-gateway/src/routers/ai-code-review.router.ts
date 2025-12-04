// TODO: CodeReviewService 尚未实现,暂时注释
// import { CodeReviewService } from '@juanie/service-extensions'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * AI 代码审查 Router
 * 提供代码审查相关的 API
 *
 * TODO: 等待 CodeReviewService 实现后启用
 */
@Injectable()
export class AICodeReviewRouter {
  constructor(
    private readonly trpc: TrpcService,
    // private readonly codeReviewService: CodeReviewService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 全面代码审查
       * TODO: 等待 CodeReviewService 实现
       */
      comprehensive: this.trpc.procedure
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
            model: z
              .enum([
                'qwen2.5-coder:7b',
                'deepseek-coder:6.7b',
                'codellama:7b',
                'mistral:7b',
                'llama3.1:8b',
              ])
              .optional(),
            context: z
              .object({
                projectType: z.string().optional(),
                framework: z.string().optional(),
                relatedFiles: z.array(z.string()).optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ input: _input }) => {
          // TODO: 实现 CodeReviewService 后启用
          throw new Error('CodeReviewService not implemented yet')
          // return this.codeReviewService.comprehensiveReview(_input)
        }),

      /**
       * 快速代码审查
       * TODO: 等待 CodeReviewService 实现
       */
      quick: this.trpc.procedure
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
            model: z
              .enum([
                'qwen2.5-coder:7b',
                'deepseek-coder:6.7b',
                'codellama:7b',
                'mistral:7b',
                'llama3.1:8b',
              ])
              .optional(),
          }),
        )
        .mutation(async ({ input: _input }) => {
          // TODO: 实现 CodeReviewService 后启用
          throw new Error('CodeReviewService not implemented yet')
          // return this.codeReviewService.quickReview(input)
        }),

      /**
       * 安全聚焦审查
       * TODO: 等待 CodeReviewService 实现
       */
      security: this.trpc.procedure
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
            model: z
              .enum([
                'qwen2.5-coder:7b',
                'deepseek-coder:6.7b',
                'codellama:7b',
                'mistral:7b',
                'llama3.1:8b',
              ])
              .optional(),
          }),
        )
        .mutation(async ({ input: _input }) => {
          // TODO: 实现 CodeReviewService 后启用
          throw new Error('CodeReviewService not implemented yet')
          // return this.codeReviewService.securityFocusedReview(input)
        }),

      /**
       * 批量代码审查
       * TODO: 等待 CodeReviewService 实现
       */
      batch: this.trpc.procedure
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
            model: z
              .enum([
                'qwen2.5-coder:7b',
                'deepseek-coder:6.7b',
                'codellama:7b',
                'mistral:7b',
                'llama3.1:8b',
              ])
              .optional(),
          }),
        )
        .mutation(async ({ input: _input }) => {
          // TODO: 实现 CodeReviewService 后启用
          throw new Error('CodeReviewService not implemented yet')
          // return this.codeReviewService.batchReview(input)
        }),
    })
  }
}
