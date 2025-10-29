import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { CostTrackingService } from './cost-tracking.service'

@Injectable()
export class CostTrackingRouter {
  constructor(
    private trpc: TrpcService,
    private costTrackingService: CostTrackingService,
  ) {}

  get router() {
    return this.trpc.router({
      record: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.uuid(),
            projectId: z.uuid().optional(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            costs: z.object({
              compute: z.number(),
              storage: z.number(),
              network: z.number(),
              database: z.number(),
              total: z.number(),
            }),
            currency: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.costTrackingService.record(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.uuid(),
            projectId: z.uuid().optional(),
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.costTrackingService.list(ctx.user.id, input)
        }),

      getSummary: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.uuid(),
            projectId: z.uuid().optional(),
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.costTrackingService.getSummary(ctx.user.id, input)
        }),

      checkAlerts: this.trpc.protectedProcedure
        .input(z.object({ organizationId: z.uuid() }))
        .query(async ({ input }) => {
          return await this.costTrackingService.checkAlerts(input.organizationId)
        }),
    })
  }
}
