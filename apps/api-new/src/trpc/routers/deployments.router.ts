import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DeploymentsService } from "../../deployments/deployments.service";
import {
  cancelDeploymentSchema,
  createDeploymentSchema,
  deploymentLogsSchema,
  deploymentSchema,
  deploymentStatsSchema,
  getDeploymentByIdSchema,
  getDeploymentLogsSchema,
  getDeploymentStatsSchema,
  listDeploymentsByProjectSchema,
  redeploySchema,
  rollbackDeploymentSchema,
  updateDeploymentSchema,
} from "../../schemas/deployment.schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const createDeploymentsRouter = (
  deploymentsService: DeploymentsService
) => {
  return createTRPCRouter({
    // 创建部署
    create: protectedProcedure
      .input(createDeploymentSchema)
      .output(deploymentSchema)
      .mutation(async ({ input, ctx }) => {
        return await deploymentsService.create(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 根据项目ID获取部署列表
    listByProject: protectedProcedure
      .input(listDeploymentsByProjectSchema)
      .output(z.array(deploymentSchema))
      .query(async ({ input, ctx }) => {
        return await deploymentsService.listByProject(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 根据ID获取部署详情
    getById: protectedProcedure
      .input(getDeploymentByIdSchema)
      .output(deploymentSchema)
      .query(async ({ input, ctx }) => {
        return await deploymentsService.getById(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 获取部署统计信息
    getStats: protectedProcedure
      .input(getDeploymentStatsSchema)
      .output(deploymentStatsSchema)
      .query(async ({ input, ctx }) => {
        const stats = await deploymentsService.getStats(
          input,
          Number(ctx.session.userId)
        );
        return stats;
      }),

    // 重新部署
    redeploy: protectedProcedure
      .input(redeploySchema)
      .output(deploymentSchema)
      .mutation(async ({ input, ctx }) => {
        const deployment = await deploymentsService.redeploy(
          input,
          Number(ctx.session.userId)
        );
        return deployment;
      }),

    // 回滚部署
    rollback: protectedProcedure
      .input(rollbackDeploymentSchema)
      .output(deploymentSchema)
      .mutation(async ({ input, ctx }) => {
        const deployment = await deploymentsService.rollback(
          input,
          Number(ctx.session.userId)
        );
        return deployment;
      }),

    // 取消部署
    cancel: protectedProcedure
      .input(cancelDeploymentSchema)
      .output(deploymentSchema)
      .mutation(async ({ input, ctx }) => {
        const deployment = await deploymentsService.cancel(
          input,
          Number(ctx.session.userId)
        );
        return deployment;
      }),

    // 获取部署日志
    getLogs: protectedProcedure
      .input(getDeploymentLogsSchema)
      .output(deploymentLogsSchema)
      .query(async ({ input, ctx }) => {
        const logs = await deploymentsService.getLogs(
          input,
          Number(ctx.session.userId)
        );
        return logs;
      }),
  });
};
