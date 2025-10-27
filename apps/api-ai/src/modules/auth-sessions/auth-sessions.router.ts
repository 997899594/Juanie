import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthSessionsService } from './auth-sessions.service';
import {
  insertAuthSessionSchema,
  selectAuthSessionSchema,
} from '../../database/schemas/auth-sessions.schema';


@Injectable()
export class AuthSessionsRouter {
  constructor(
    private readonly authSessionsService: AuthSessionsService,
    private readonly trpc: TrpcService
  ) {}

  public get authSessionsRouter() {
    return this.trpc.router({
    // Hello endpoint for testing
    hello: this.trpc.publicProcedure
      .input(z.object({ name: z.string().optional() }))
      .query(({ input }) => {
        return {
          greeting: `Hello ${input.name ?? 'World'}!`,
        };
      }),

    // 创建新会话
    create: this.trpc.protectedProcedure
      .input(z.object({
        userId: z.string().uuid(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
        expiresInHours: z.number().min(1).max(168).default(24),
      }))
      .mutation(async ({ input }) => {
        return await this.authSessionsService.createSession(
          input.userId,
          input.ipAddress,
          input.userAgent,
          input.expiresInHours
        );
      }),

    // 根据ID获取会话详情
    getById: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        const session = await this.authSessionsService.getSessionDetails(input.id);
        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          });
        }
        return session;
      }),

    // 获取用户活跃会话列表
    getUserActiveSessions: this.trpc.protectedProcedure
      .input(z.object({
        userId: z.string().uuid(),
        currentSessionId: z.string().uuid().optional(),
      }))
      .query(async ({ input }) => {
        return await this.authSessionsService.getUserActiveSessions(
          input.userId,
          input.currentSessionId
        );
      }),

    // 验证会话（通过令牌）
    validateByToken: this.trpc.protectedProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const result = await this.authSessionsService.validateSessionByToken(input.sessionToken);
        return { isValid: !!result, result };
      }),

    // 验证会话（通过ID）
    validateById: this.trpc.protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .query(async ({ input }) => {
        const result = await this.authSessionsService.validateSessionById(input.sessionId);
        return { isValid: !!result, result };
      }),

    // 刷新会话
    refresh: this.trpc.protectedProcedure
      .input(z.object({ refreshToken: z.string() }))
      .mutation(async ({ input }) => {
        const result = await this.authSessionsService.refreshSession(input.refreshToken);
        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found or expired',
          });
        }
        return result;
      }),

    // 撤销会话（通过令牌）
    revokeByToken: this.trpc.protectedProcedure
      .input(z.object({ sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        const success = await this.authSessionsService.revokeSession(input.sessionToken);
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to revoke session',
          });
        }
        return { success: true };
      }),

    // 撤销会话（通过ID）
    revokeById: this.trpc.protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const success = await this.authSessionsService.revokeSessionById(input.sessionId);
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to revoke session',
          });
        }
        return { success: true };
      }),

    // 撤销用户所有会话
    revokeAllUser: this.trpc.protectedProcedure
      .input(z.object({
        userId: z.string().uuid(),
        exceptSessionId: z.string().uuid().optional(),
      }))
      .mutation(async ({ input }) => {
        const count = await this.authSessionsService.revokeAllUserSessions(
          input.userId,
          input.exceptSessionId
        );
        return { revokedCount: count };
      }),

    // 批量撤销会话
    batchRevoke: this.trpc.protectedProcedure
      .input(z.object({
        sessionIds: z.array(z.string().uuid()).min(1).max(50),
      }))
      .mutation(async ({ input }) => {
        const count = await this.authSessionsService.batchRevokeSessions(input.sessionIds);
        return { revokedCount: count };
      }),

    // 获取会话统计信息
    getStats: this.trpc.protectedProcedure
      .input(z.object({
        userId: z.string().uuid().optional(),
      }))
      .query(async ({ input }) => {
        return await this.authSessionsService.getSessionStats(input.userId);
      }),

    // 更新会话最后使用时间
    updateLastUsed: this.trpc.protectedProcedure
      .input(z.object({
        sessionId: z.string().uuid(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await this.authSessionsService.updateSessionLastUsed(
          input.sessionId,
          input.ipAddress,
          input.userAgent
        );
        return { success: true };
      }),

    // 清理过期会话
    cleanupExpired: this.trpc.protectedProcedure
      .mutation(async () => {
        const count = await this.authSessionsService.cleanupExpiredSessions();
        return { cleanedCount: count };
      }),

    // 删除旧的已撤销会话
    deleteOldRevoked: this.trpc.protectedProcedure
      .input(z.object({
        olderThanDays: z.number().min(1).default(90),
      }))
      .mutation(async ({ input }) => {
        const count = await this.authSessionsService.deleteOldRevokedSessions(input.olderThanDays);
        return { deletedCount: count };
      }),

    // 检查会话是否有效
    isValid: this.trpc.protectedProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const isValid = await this.authSessionsService.isSessionValid(input.sessionToken);
        return { isValid };
      }),

    // 批量删除会话
    batchDelete: this.trpc.protectedProcedure
      .input(z.object({
        sessionIds: z.array(z.string().uuid()).min(1).max(50),
      }))
      .mutation(async ({ input }) => {
        const count = await this.authSessionsService.batchDeleteSessions(input.sessionIds);
        return { deletedCount: count };
      }),

    // 获取活跃会话数量
    getActiveCount: this.trpc.protectedProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .query(async ({ input }) => {
        const count = await this.authSessionsService.getActiveSessionCount(input.userId);
        return { count };
      }),

    // 清理不活跃会话
    cleanupInactive: this.trpc.protectedProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const count = await this.authSessionsService.cleanupInactiveSessions(input.userId);
        return { cleanedCount: count };
      }),
    });
  }
}