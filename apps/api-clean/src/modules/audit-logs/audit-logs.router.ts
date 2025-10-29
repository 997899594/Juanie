import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { AuditLogsService } from './audit-logs.service'

@Injectable()
export class AuditLogsRouter {
  constructor(
    private trpc: TrpcService,
    private auditLogsService: AuditLogsService,
  ) {}

  router = this.trpc.router({
    list: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid().optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return await this.auditLogsService.list(ctx.user.id, input)
      }),

    search: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid(),
          query: z.string().optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return await this.auditLogsService.search(ctx.user.id, input)
      }),

    export: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          format: z.enum(['csv', 'json']),
        }),
      )
      .query(async ({ ctx, input }) => {
        return await this.auditLogsService.export(ctx.user.id, input)
      }),
  })
}
