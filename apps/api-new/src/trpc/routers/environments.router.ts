import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EnvironmentsService } from '../../environments/environments.service';
import { 
  createEnvironmentSchema,
  updateEnvironmentSchema,
  getEnvironmentByIdSchema,
  listEnvironmentsByProjectSchema,
  deleteEnvironmentSchema,
  environmentSchema,
} from '../../schemas/environment.schema';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const createEnvironmentsRouter = (environmentsService: EnvironmentsService) => {
  return createTRPCRouter({
    // 创建环境
    create: protectedProcedure
      .input(createEnvironmentSchema)
      .output(environmentSchema)
      .mutation(async ({ input, ctx }) => {
        return await environmentsService.create(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 获取项目环境列表
    listByProject: protectedProcedure
      .input(listEnvironmentsByProjectSchema)
      .output(z.array(environmentSchema))
      .query(async ({ input, ctx }) => {
        return await environmentsService.listByProject(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 获取环境详情
    getById: protectedProcedure
      .input(getEnvironmentByIdSchema)
      .output(environmentSchema)
      .query(async ({ input, ctx }) => {
        return await environmentsService.getById(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 更新环境
    update: protectedProcedure
      .input(updateEnvironmentSchema)
      .output(environmentSchema)
      .mutation(async ({ input, ctx }) => {
        return await environmentsService.update(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 删除环境
    delete: protectedProcedure
      .input(deleteEnvironmentSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await environmentsService.delete(
          input,
          Number(ctx.session.userId)
        );
        return { success: true };
      }),
  });
};