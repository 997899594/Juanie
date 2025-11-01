import {
  approveDeploymentSchema,
  createDeploymentSchema,
  deploymentIdSchema,
  rejectDeploymentSchema,
  rollbackDeploymentSchema,
} from '@juanie/core-types'
import { DeploymentsService } from '@juanie/service-deployments'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class DeploymentsRouter {
  constructor(
    private trpc: TrpcService,
    private deploymentsService: DeploymentsService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(createDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.create(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid().optional(),
            environmentId: z.string().uuid().optional(),
            status: z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.deploymentsService.list(ctx.user.id, input)
        }),

      get: this.trpc.protectedProcedure.input(deploymentIdSchema).query(async ({ ctx, input }) => {
        return await this.deploymentsService.get(ctx.user.id, input.deploymentId)
      }),

      rollback: this.trpc.protectedProcedure
        .input(rollbackDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.rollback(ctx.user.id, input.deploymentId)
        }),

      approve: this.trpc.protectedProcedure
        .input(approveDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          const { deploymentId, ...data } = input
          return await this.deploymentsService.approve(ctx.user.id, deploymentId, data)
        }),

      reject: this.trpc.protectedProcedure
        .input(rejectDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          const { deploymentId, ...data } = input
          return await this.deploymentsService.reject(ctx.user.id, deploymentId, data)
        }),
    })
  }
}
