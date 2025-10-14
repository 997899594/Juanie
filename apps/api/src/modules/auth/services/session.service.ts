import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type { DrizzleService } from "../../../drizzle/drizzle.service";
import * as schema from "../../../drizzle/schemas";

export interface SessionPayload {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly sessionTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly refreshTokenTTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    private readonly configService: ConfigService,
    private readonly drizzleService: DrizzleService
  ) {}

  private generateSecureToken(): string {
    return randomBytes(32).toString("base64url");
  }

  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<any> {
    const sessionToken = this.generateSecureToken();
    const refreshTokenValue = this.generateSecureToken();
    const now = new Date();
    const sessionExpiresAt = new Date(now.getTime() + this.sessionTTL);
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTTL);

    // 创建Session
    const [session] = await this.drizzleService.db
      .insert(schema.sessions)
      .values({
        userId,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        userAgent,
        ipAddress,
        deviceInfo: this.parseDeviceInfo(userAgent),
      })
      .returning();

    // 创建刷新令牌
    const [refreshToken] = await this.drizzleService.db
      .insert(schema.refreshTokens)
      .values({
        sessionId: session!.id,
        token: refreshTokenValue,
        expiresAt: refreshExpiresAt,
      })
      .returning();

    return { session, refreshToken };
  }

  async validateSession(token: string): Promise<any> {
    const [session] = await this.drizzleService.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .limit(1);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    // 更新最后活跃时间
    await this.drizzleService.db
      .update(schema.sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.sessions.id, session.id));

    return {
      sessionId: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
  }

  async refreshSession(refreshToken: string): Promise<any> {
    // 实现刷新逻辑
    return null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.drizzleService.db
      .update(schema.sessions)
      .set({ isActive: false })
      .where(eq(schema.sessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.drizzleService.db
      .update(schema.sessions)
      .set({ isActive: false })
      .where(eq(schema.sessions.userId, userId));
  }

  async getUserActiveSessions(userId: string): Promise<any[]> {
    return await this.drizzleService.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.drizzleService.db
      .delete(schema.sessions)
      .where(eq(schema.sessions.expiresAt, new Date()));
  }

  private parseDeviceInfo(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    if (userAgent.includes("Mobile")) return "Mobile";
    if (userAgent.includes("Tablet")) return "Tablet";
    return "Desktop";
  }
}
