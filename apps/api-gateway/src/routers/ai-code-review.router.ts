import { CodeReviewService } from '@juanie/service-extensions'
import { batchCodeReviewRequestSchema, codeReviewRequestSchema } from '@juanie/types'
import { Injectable } from '@nestjs/common'
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
        .input(codeReviewRequestSchema)
        .mutation(async ({ input }) => {
          return this.codeReviewService.comprehensiveReview(input)
        }),

      /**
       * 快速代码审查（仅关键问题）
       */
      quick: this.trpc.protectedProcedure
        .input(codeReviewRequestSchema)
        .mutation(async ({ input }) => {
          return this.codeReviewService.quickReview(input)
        }),

      /**
       * 安全聚焦审查
       */
      security: this.trpc.protectedProcedure
        .input(codeReviewRequestSchema)
        .mutation(async ({ input }) => {
          return this.codeReviewService.securityFocusedReview(input)
        }),

      /**
       * 批量代码审查
       */
      batch: this.trpc.protectedProcedure
        .input(batchCodeReviewRequestSchema)
        .mutation(async ({ input }) => {
          return this.codeReviewService.batchReview(input)
        }),
    })
  }
}
