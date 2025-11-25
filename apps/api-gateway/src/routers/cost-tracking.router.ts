import {
  getCostSummarySchema,
  listCostsSchema,
  organizationIdQuerySchema,
  recordCostSchema,
} from '@juanie/types'
import { CostTrackingService } from '@juanie/service-extensions'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class CostTrackingRouter {
  constructor(
    private trpc: TrpcService,
    private costTrackingService: CostTrackingService,
  ) {}

  get router() {
    return this.trpc.router({
      record: this.trpc.protectedProcedure
        .input(recordCostSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.costTrackingService.record(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure.input(listCostsSchema).query(async ({ ctx, input }) => {
        return await this.costTrackingService.list(ctx.user.id, input)
      }),

      getSummary: this.trpc.protectedProcedure
        .input(getCostSummarySchema)
        .query(async ({ ctx, input }) => {
          return await this.costTrackingService.getSummary(ctx.user.id, input)
        }),

      checkAlerts: this.trpc.protectedProcedure
        .input(organizationIdQuerySchema)
        .query(async ({ input }) => {
          return await this.costTrackingService.checkAlerts(input.organizationId)
        }),
    })
  }
}
