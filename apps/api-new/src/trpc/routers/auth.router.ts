import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AuthService } from "../../auth/auth.service";
import { publicProcedure, router } from "../trpc";

export function createAuthRouter(authService: AuthService) {
  return router({
  // 获取当前用户信息
    getCurrentUser: publicProcedure.query(async ({ ctx }) => {
      const sessionId = ctx.req.cookies?.session;
      if (!sessionId) {
        return null;
      }

      try {
        const result = await authService.validateSession(sessionId);
        return result ? result.user : null;
      } catch (error) {
        console.error("获取当前用户失败:", error);
        return null;
      }
    }),

  // 获取GitHub OAuth登录URL
  getGitHubAuthUrl: publicProcedure
    .input(z.object({ redirectTo: z.string().optional() }))
    .query(async ({ input }) => {
      try {
          const result = await authService.createGitHubAuthUrl(input.redirectTo);
          return result;
        } catch (error) {
        console.error("获取GitHub授权URL失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取GitHub授权URL失败",
        });
      }
    }),

  // 获取GitLab OAuth登录URL
  getGitLabAuthUrl: publicProcedure
    .input(z.object({ redirectTo: z.string().optional() }))
    .query(async ({ input }) => {
      try {
          const result = await authService.createGitLabAuthUrl(input.redirectTo);
          return result;
        } catch (error) {
        console.error("获取GitLab授权URL失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取GitLab授权URL失败",
        });
      }
    }),

  // 用户登出
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionId = ctx.req.cookies?.session;
      if (!sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "未找到会话",
        });
      }

      try {
        await authService.deleteSession(sessionId);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "登出失败",
        });
      }
    }),

  // 检查认证状态
    checkAuth: publicProcedure.query(async ({ ctx }) => {
      console.log("=== checkAuth 调试信息 ===");
      console.log("所有 cookies:", ctx.req.cookies);
      
      const sessionId = ctx.req.cookies?.session;
      console.log("提取的 sessionId:", sessionId);
      
      if (!sessionId) {
        console.log("未找到 session cookie");
        return { isAuthenticated: false, user: null };
      }

      try {
        console.log("调用 validateSession，sessionId:", sessionId);
        const result = await authService.validateSession(sessionId);
        console.log("validateSession 结果:", result);
        
        if (result) {
          console.log("认证成功，用户:", result.user.email);
          return { isAuthenticated: true, user: result.user };
        } else {
          console.log("认证失败，会话无效或已过期");
          return { isAuthenticated: false, user: null };
        }
      } catch (error) {
        console.error("认证检查失败:", error);
        return { isAuthenticated: false, user: null };
      }
    }),
});

}
