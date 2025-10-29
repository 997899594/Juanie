import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { DeploymentsService } from './deployments.service'

@Injectable()
export class DeploymentsRouter {
  constructor(
    private trpc: TrpcService,
    private deploymentsService: DeploymentsService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.uuid(),
            environmentId: z.uuid(),
            pipelineRunId: z.uuid().optional(),
            version: z.string(),
            commitHash: z.string(),
            branch: z.string(),
            strategy: z.enum(['rolling', 'blue_green', 'canary']).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.create(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.uuid().optional(),
            environmentId: z.uuid().optional(),
            status: z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.deploymentsService.list(ctx.user.id, input)
        }),

      get: this.trpc.protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .query(async ({ ctx, input }) => {
          return await this.deploymentsService.get(ctx.user.id, input.id)
        }),

      rollback: this.trpc.protectedProcedure
        .input(z.object({ id: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.rollback(ctx.user.id, input.id)
        }),

      approve: this.trpc.protectedProcedure
        .input(
          z.object({
            deploymentId: z.uuid(),
            comments: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.approve(
            ctx.user.id,
            input.deploymentId,
            input.comments,
          )
        }),

      reject: this.trpc.protectedProcedure
        .input(
          z.object({
            deploymentId: z.uuid(),
            comments: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.reject(
            ctx.user.id,
            input.deploymentId,
            input.comments,
          )
        }),
    })
  }
}
