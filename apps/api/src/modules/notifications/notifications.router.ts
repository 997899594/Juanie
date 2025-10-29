import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { NotificationsService } from './notifications.service'

@Injectable()
export class NotificationsRouter {
  constructor(
    private trpc: TrpcService,
    private notificationsService: NotificationsService,
  ) {}

  get router() {
    return this.trpc.router({
      list: this.trpc.protectedProcedure
        .input(
          z
            .object({
              status: z.string().optional(),
            })
            .optional(),
        )
        .query(async ({ ctx, input }) => {
          return await this.notificationsService.list(ctx.user.id, input)
        }),

      markAsRead: this.trpc.protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
          return await this.notificationsService.markAsRead(ctx.user.id, input.id)
        }),

      markAllAsRead: this.trpc.protectedProcedure.mutation(async ({ ctx }) => {
        return await this.notificationsService.markAllAsRead(ctx.user.id)
      }),

      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
          return await this.notificationsService.delete(ctx.user.id, input.id)
        }),

      getUnreadCount: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.notificationsService.getUnreadCount(ctx.user.id)
      }),
    })
  }
}
