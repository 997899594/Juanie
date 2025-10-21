import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { AuthService } from "../../auth/auth.service";
import {
  authResponseSchema,
  authUrlResponseSchema,
  createAuthUrlSchema,
  loginInputSchema,
  oauthCallbackSchema,
  registerInputSchema,
  updateUserInputSchema,
  userResponseSchema,
} from "../../schemas/auth.schema";
import { successResponseSchema } from "../../schemas/common.schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const createAuthRouter = (authService: AuthService) => {
  return createTRPCRouter({
    // 获取当前用户信息
    getCurrentUser: protectedProcedure
      .output(userResponseSchema.nullable())
      .query(async ({ ctx }) => {
        try {
          return await authService.getUserById(Number(ctx.session!.userId));
        } catch (error) {
          throw new Error(`获取用户信息失败: ${error.message}`);
        }
      }),

    // 用户登录
    login: publicProcedure
      .input(loginInputSchema)
      .output(successResponseSchema.extend({ data: authResponseSchema }))
      .mutation(async ({ input, ctx }) => {
        try {
          // 这里需要实现登录逻辑，暂时抛出错误提示需要实现
          throw new Error("登录功能需要在AuthService中实现");
        } catch (error) {
          throw new Error(`登录失败: ${error.message}`);
        }
      }),

    // 用户注册
    register: publicProcedure
      .input(registerInputSchema)
      .output(successResponseSchema.extend({ data: authResponseSchema }))
      .mutation(async ({ input, ctx }) => {
        try {
          // 这里需要实现注册逻辑，暂时抛出错误提示需要实现
          throw new Error("注册功能需要在AuthService中实现");
        } catch (error) {
          throw new Error(`注册失败: ${error.message}`);
        }
      }),

    // 更新用户信息
    updateProfile: protectedProcedure
      .input(updateUserInputSchema)
      .output(successResponseSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const updatedUser = await authService.updateUser(
            Number(ctx.session.userId),
            input
          );
          return {
            success: true as const,
            message: "用户信息更新成功",
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new Error(
            `更新用户信息失败: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }),

    // 获取GitLab OAuth登录URL
    getGitLabAuthUrl: publicProcedure
      .input(createAuthUrlSchema)
      .output(authUrlResponseSchema)
      .query(async ({ input }) => {
        try {
          return await authService.createGitLabAuthUrl(input);
        } catch (error) {
          throw new Error(`获取GitLab认证URL失败: ${error.message}`);
        }
      }),

    // 用户登出
    logout: protectedProcedure
      .output(successResponseSchema)
      .mutation(async ({ ctx }) => {
        try {
          await authService.deleteSession({
            sessionId: ctx.session!.sessionId,
            allSessions: false,
          });

          // 清除cookie
          ctx.res.clearCookie("session");

          return {
            success: true as const,
            data: null,
            message: "登出成功",
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new Error(`登出失败: ${error.message}`);
        }
      }),

    // 检查认证状态
    checkAuth: publicProcedure
      .output(
        successResponseSchema.extend({
          data: z.object({
            isAuthenticated: z.boolean(),
            user: userResponseSchema.nullable(),
          }),
        })
      )
      .query(async ({ ctx }) => {
        try {
          const isAuthenticated = !!ctx.session?.userId;
          const user = isAuthenticated
            ? await authService.getUserById(Number(ctx.session!.userId))
            : null;

          return {
            success: true as const,
            data: {
              isAuthenticated,
              user,
            },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new Error(`检查认证状态失败: ${error.message}`);
        }
      }),
  });
};
