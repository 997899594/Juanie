import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AuthService } from "../../auth/auth.service";
import { publicProcedure, router } from "../trpc";
import { 
  loginInputSchema, 
  registerInputSchema,
  updateUserInputSchema 
} from "../../common/validators/auth.validators";
import { 
  User, 
  AuthResponse,
  ApiResponse 
} from "../../common/types/api.types";

export function createAuthRouter(authService: AuthService) {
  return router({
    // 获取当前用户信息
    getCurrentUser: publicProcedure
      .output(z.custom<User>().nullable())
      .query(async ({ ctx }) => {
        // 会话验证已在 createContext 中完成，直接返回用户信息
        return ctx.session
          ? await authService.getUserById(ctx.session.userId)
          : null;
      }),

    // 用户登录
    login: publicProcedure
      .input(loginInputSchema)
      .output(z.custom<ApiResponse<AuthResponse>>())
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await authService.login(input);
          
          // 设置会话 cookie
          ctx.res.cookie('session', result.session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          return {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: error instanceof Error ? error.message : "登录失败",
          });
        }
      }),

    // 用户注册
    register: publicProcedure
      .input(registerInputSchema)
      .output(z.custom<ApiResponse<AuthResponse>>())
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await authService.register(input);
          
          // 设置会话 cookie
          ctx.res.cookie('session', result.session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          return {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "注册失败",
          });
        }
      }),

    // 更新用户信息
    updateProfile: publicProcedure
      .input(updateUserInputSchema)
      .output(z.custom<ApiResponse<User>>())
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "请先登录",
          });
        }

        try {
          const updatedUser = await authService.updateUser(ctx.session.userId, input);
          return {
            success: true,
            data: updatedUser,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "更新用户信息失败",
          });
        }
      }),

    // 获取GitLab OAuth登录URL
    getGitLabAuthUrl: publicProcedure
      .input(z.object({ redirectTo: z.string().optional() }))
      .output(z.object({ 
        url: z.string(),
        state: z.string().optional() 
      }))
      .query(async ({ input }) => {
        try {
          const result = await authService.createGitLabAuthUrl(
            input.redirectTo
          );
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
    logout: publicProcedure
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ ctx }) => {
        if (!ctx.session?.sessionId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "未找到会话",
          });
        }

        try {
          await authService.deleteSession(ctx.session.sessionId);
          
          // 清除会话 cookie
          ctx.res.clearCookie('session');
          
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "登出失败",
          });
        }
      }),

    // 检查认证状态
    checkAuth: publicProcedure
      .output(z.object({
        isAuthenticated: z.boolean(),
        user: z.custom<User>().nullable(),
      }))
      .query(async ({ ctx }) => {
        const isAuthenticated = !!ctx.session?.userId;
        const user = isAuthenticated 
          ? await authService.getUserById(ctx.session.userId)
          : null;
        
        return {
          isAuthenticated,
          user,
        };
      }),
  });
}
