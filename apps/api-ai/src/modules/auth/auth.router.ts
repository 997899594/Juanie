import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthService } from './auth.service';
import { z } from 'zod';
import { selectUserSchema } from '../../database/schemas/users.schema';
import { selectAuthSessionSchema } from '../../database/schemas/auth-sessions.schema';

@Injectable()
export class AuthRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authService: AuthService,
  ) {}

  public get authRouter() {
    return this.trpc.router({
      // 获取GitLab OAuth授权URL
      getGitLabAuthUrl: this.trpc.publicProcedure
        .input(z.object({
          redirectTo: z.string().optional()
        }))
        .output(z.object({
          url: z.string(),
          state: z.string()
        }))
        .mutation(async ({ input }) => {
          return await this.authService.createGitLabAuthUrl(input.redirectTo);
        }),

      // 处理GitLab OAuth回调
      handleGitLabCallback: this.trpc.publicProcedure
        .input(z.object({
          code: z.string(),
          state: z.string()
        }))
        .output(z.object({
          user: selectUserSchema,
          session: selectAuthSessionSchema,
          accessToken: z.string().optional()
        }))
        .mutation(async ({ input }) => {
          return await this.authService.handleGitLabCallback(input.code, input.state);
        }),

      // 验证会话
      validateSession: this.trpc.publicProcedure
        .input(z.object({
          sessionToken: z.string()
        }))
        .output(z.object({
          user: selectUserSchema,
          session: selectAuthSessionSchema
        }).nullable())
        .query(async ({ input }) => {
          return await this.authService.validateSession(input.sessionToken);
        }),

      // 刷新会话
      refreshSession: this.trpc.publicProcedure
        .input(z.object({
          refreshToken: z.string()
        }))
        .output(selectAuthSessionSchema.nullable())
        .mutation(async ({ input }) => {
          return await this.authService.refreshSession(input.refreshToken);
        }),

      // 注销会话
      revokeSession: this.trpc.protectedProcedure
        .input(z.object({
          sessionToken: z.string()
        }))
        .mutation(async ({ input }) => {
          await this.authService.revokeSession(input.sessionToken);
          return { success: true };
        }),

      // 注销用户所有会话
      revokeAllSessions: this.trpc.protectedProcedure
        .mutation(async ({ ctx }) => {
          await this.authService.revokeAllUserSessions(ctx.user.id);
          return { success: true };
        }),

      // 获取用户活跃会话
      getActiveSessions: this.trpc.protectedProcedure
        .output(z.array(selectAuthSessionSchema))
        .query(async ({ ctx }) => {
          return await this.authService.getUserActiveSessions(ctx.user.id);
        }),

      // 健康检查
      hello: this.trpc.publicProcedure
        .query(() => {
          return this.authService.hello();
        }),
    });
  }
}