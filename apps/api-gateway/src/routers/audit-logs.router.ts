import { AuditLogsService } from '@juanie/service-foundation'
import { exportAuditLogsSchema, listAuditLogsSchema, searchAuditLogsSchema } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class AuditLogsRouter {
  constructor(
    private trpc: TrpcService,
    private auditLogsService: AuditLogsService,
  ) {}

  get router() {
    return this.trpc.router({
      list: this.trpc.protectedProcedure
        .input(listAuditLogsSchema)
        .query(async ({ ctx, input }) => {
          return await this.auditLogsService.list(ctx.user.id, input)
        }),

      search: this.trpc.protectedProcedure
        .input(searchAuditLogsSchema)
        .query(async ({ ctx, input }) => {
          return await this.auditLogsService.search(ctx.user.id, input)
        }),

      export: this.trpc.protectedProcedure
        .input(exportAuditLogsSchema)
        .query(async ({ ctx, input }) => {
          return await this.auditLogsService.export(ctx.user.id, input)
        }),
    })
  }
}
