import {
  createSecurityPolicySchema,
  idSchema,
  securityPolicyIdSchema,
  updateSecurityPolicySchema,
} from '@juanie/core-types'
import { SecurityPoliciesService } from '@juanie/service-security-policies'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class SecurityPoliciesRouter {
  constructor(
    private trpc: TrpcService,
    private securityPoliciesService: SecurityPoliciesService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.uuid().optional(),
            projectId: z.uuid().optional(),
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
            organizationId: z.uuid().optional(),
            projectId: z.uuid().optional(),
            type: z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.securityPoliciesService.list(ctx.user.id, input)
        }),

      get: this.trpc.protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
        return await this.securityPoliciesService.get(ctx.user.id, input.id)
      }),

      update: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.uuid(),
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

      delete: this.trpc.protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
        return await this.securityPoliciesService.delete(ctx.user.id, input.id)
      }),

      evaluate: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.uuid().optional(),
            projectId: z.uuid().optional(),
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
}
