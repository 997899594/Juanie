import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { SecurityPoliciesService } from './security-policies.service'

@Injectable()
export class SecurityPoliciesRouter {
  constructor(
    private trpc: TrpcService,
    private securityPoliciesService: SecurityPoliciesService,
  ) {}

  router = this.trpc.router({
    create: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          name: z.string(),
          type: z.enum(['access-control', 'network', 'data-protection', 'compliance']),
          rules: z.object({
            conditions: z.array(
              z.object({
                field: z.string(),
                operator: z.string(),
                value: z.any(),
              }),
            ),
            actions: z.array(
              z.object({
                type: z.enum(['block', 'warn', 'log']),
                message: z.string(),
              }),
            ),
          }),
          isEnforced: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await this.securityPoliciesService.create(ctx.user.id, input)
      }),

    list: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          type: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return await this.securityPoliciesService.list(ctx.user.id, input)
      }),

    get: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return await this.securityPoliciesService.get(ctx.user.id, input.id)
      }),

    update: this.trpc.protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().optional(),
          rules: z
            .object({
              conditions: z.array(
                z.object({
                  field: z.string(),
                  operator: z.string(),
                  value: z.any(),
                }),
              ),
              actions: z.array(
                z.object({
                  type: z.enum(['block', 'warn', 'log']),
                  message: z.string(),
                }),
              ),
            })
            .optional(),
          isEnforced: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input
        return await this.securityPoliciesService.update(ctx.user.id, id, data)
      }),

    delete: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return await this.securityPoliciesService.delete(ctx.user.id, input.id)
      }),

    evaluate: this.trpc.protectedProcedure
      .input(
        z.object({
          organizationId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          action: z.string(),
          resource: z.any(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return await this.securityPoliciesService.evaluate({
          ...input,
          user: ctx.user,
        })
      }),
  })
}
