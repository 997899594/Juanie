import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GitLab } from "arctic";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { alphabet, generateRandomString, sha256 } from "oslo/crypto";
import { encodeBase64url } from "oslo/encoding";
import { PG_CONNECTION } from "../db/drizzle.provider";
import type { SelectSession, SelectUser } from "../db/schema";
import { accounts, sessions, users } from "../db/schema";
import {
  AuthResponse,
  AuthUrlResponse,
  CreateAuthUrlInput,
  createAuthUrlSchema,
  LogoutInput,
  logoutSchema,
  OAuthCallbackInput,
  OAuthProvider,
  oauthCallbackSchema,
  SessionResponse,
  UserResponse,
} from "../schemas/auth.schema";
import { SessionCacheService } from "./session-cache.service";

export interface OAuthState {
  provider: "gitlab";
  codeVerifier: string;
  state: string;
  redirectTo?: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
}

// 全局状态存储
declare global {
  var oauthStates: Map<string, OAuthState> | undefined;
}

@Injectable()
export class AuthService {
  private gitlab?: GitLab;

  constructor(
    private readonly configService: ConfigService,
    @Inject(PG_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof import("../db/schema")>,
    private readonly sessionCacheService: SessionCacheService
  ) {
    this.initializeOAuthProviders();
  }

  private initializeOAuthProviders() {
    const gitlabClientId = this.configService.get<string>("GITLAB_CLIENT_ID");
    const gitlabClientSecret = this.configService.get<string>(
      "GITLAB_CLIENT_SECRET"
    );
    const gitlabRedirectUri =
      this.configService.get<string>("GITLAB_REDIRECT_URI") ||
      "http://localhost:3000/auth/gitlab/callback";
    const gitlabBaseUrl =
      this.configService.get<string>("GITLAB_BASE_URL") || "https://gitlab.com";

    if (gitlabClientId && gitlabClientSecret) {
      this.gitlab = new GitLab(
        gitlabBaseUrl,
        gitlabClientId,
        gitlabClientSecret,
        gitlabRedirectUri
      );
    }
  }

  /**
   * 创建 GitLab 认证 URL
   */
  async createGitLabAuthUrl(
    input?: CreateAuthUrlInput
  ): Promise<AuthUrlResponse> {
    const validatedInput = input
      ? createAuthUrlSchema.parse(input)
      : { provider: "gitlab" as const };

    if (!this.gitlab) {
      throw new BadRequestException("GitLab OAuth 未配置");
    }

    try {
      const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const codeVerifier = generateRandomString(
        128,
        alphabet("a-z", "A-Z", "0-9", "-", "_")
      );
      const codeChallenge = encodeBase64url(
        await sha256(new TextEncoder().encode(codeVerifier))
      );

      const url = await this.gitlab.createAuthorizationURL(state, [
        "read_user",
        "read_api",
      ]);

      // 存储 OAuth 状态
      if (!globalThis.oauthStates) {
        globalThis.oauthStates = new Map();
      }

      globalThis.oauthStates.set(state, {
        provider: "gitlab",
        codeVerifier,
        state,
        redirectTo: validatedInput.redirectTo,
      });

      return { url: url.toString(), state };
    } catch (error: any) {
      throw new BadRequestException(
        `创建 GitLab 认证 URL 失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 处理 GitLab OAuth 回调
   */
  async handleGitLabCallback(input: OAuthCallbackInput): Promise<AuthResponse> {
    const validatedInput = oauthCallbackSchema.parse(input);

    if (!this.gitlab) {
      throw new BadRequestException("GitLab OAuth 未配置");
    }

    if (!globalThis.oauthStates) {
      throw new BadRequestException("OAuth 状态未找到");
    }

    const storedState = globalThis.oauthStates.get(validatedInput.state || "");
    if (!storedState || storedState.provider !== "gitlab") {
      throw new BadRequestException("无效的 OAuth 状态");
    }

    try {
      const tokens = await this.gitlab.validateAuthorizationCode(
        validatedInput.code
      );

      // 获取用户信息
      const gitlabBaseUrl =
        this.configService.get<string>("GITLAB_BASE_URL") ||
        "https://gitlab.com";
      const userResponse = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("获取 GitLab 用户信息失败");
      }

      const gitlabUser: GitLabUser = await userResponse.json();

      // 创建或更新用户
      const user = await this.upsertUser({
        provider: "gitlab",
        providerId: gitlabUser.id.toString(),
        email: gitlabUser.email,
        name: gitlabUser.name,
        image: gitlabUser.avatar_url,
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken?.(),
      });

      // 创建会话
      const session = await this.createSession(user.id);

      // 清理 OAuth 状态
      globalThis.oauthStates.delete(validatedInput.state || "");

      return {
        user: this.mapToUserResponse(user),
        session: this.mapToSessionResponse(session),
        accessToken: tokens.accessToken(),
      };
    } catch (error: any) {
      throw new BadRequestException(
        `GitLab OAuth 回调处理失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 创建或更新用户
   */
  private async upsertUser(data: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    image?: string;
    accessToken: string;
    refreshToken?: string;
  }): Promise<SelectUser> {
    try {
      // 查找现有账户
      const [existingAccount] = await this.db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, data.provider),
            eq(accounts.providerId, data.providerId)
          )
        );

      if (existingAccount) {
        // 更新现有账户的令牌
        await this.db
          .update(accounts)
          .set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existingAccount.id));

        // 同时更新用户信息（同步 GitLab 上的最新信息）
        const [updatedUser] = await this.db
          .update(users)
          .set({
            name: data.name,
            email: data.email,
            image: data.image,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingAccount.userId))
          .returning();

        return updatedUser;
      }

      // 查找现有用户（通过邮箱）
      const [existingUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, data.email));

      let user: SelectUser;

      if (existingUser) {
        // 更新现有用户信息（同步 GitLab 上的最新信息）
        const [updatedUser] = await this.db
          .update(users)
          .set({
            name: data.name,
            image: data.image,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        user = updatedUser;
      } else {
        // 创建新用户
        const [newUser] = await this.db
          .insert(users)
          .values({
            email: data.email,
            name: data.name,
            image: data.image,
          })
          .returning();

        user = newUser;
      }

      // 创建新账户关联
      await this.db.insert(accounts).values({
        userId: user.id,
        provider: data.provider,
        providerId: data.providerId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      return user;
    } catch (error: any) {
      throw new BadRequestException(
        `用户创建或更新失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 创建会话
   */
  async createSession(userId: number): Promise<SelectSession> {
    try {
      const sessionId = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

      const [session] = await this.db
        .insert(sessions)
        .values({
          id: sessionId,
          userId,
          expires,
        })
        .returning();

      return session;
    } catch (error: any) {
      throw new BadRequestException(
        `会话创建失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 验证会话（带缓存优化）
   */
  async validateSession(
    sessionId: string
  ): Promise<{ user: UserResponse; session: SessionResponse } | null> {
    if (!sessionId) {
      throw new BadRequestException("Session ID is required");
    }

    // 首先检查缓存
    const cachedSession = this.sessionCacheService.get(sessionId);
    if (cachedSession) {
      // 从缓存中获取用户信息
      const user = await this.getUserById(cachedSession.userId);
      if (user) {
        return {
          user,
          session: {
            id: cachedSession.id,
            userId: cachedSession.userId,
            expires: cachedSession.expires,
            createdAt: new Date().toISOString(), // 添加createdAt字段
          },
        };
      }
    }

    try {
      const db = this.db;
      const result = await db
        .select({
          session: sessions,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const { session, user } = result[0];

      // 检查会话是否过期
      if (new Date() > session.expires) {
        // 删除过期会话
        await this.deleteSession({ sessionId, allSessions: false });
        this.sessionCacheService.delete(sessionId);
        return null;
      }

      // 缓存有效会话
      this.sessionCacheService.set(sessionId, {
        id: session.id,
        userId: user.id,
        expires: session.expires.toISOString(),
      });

      return {
        user: this.mapToUserResponse(user),
        session: this.mapToSessionResponse(session),
      };
    } catch (error: any) {
      console.error("Session validation error:", error);
      throw new UnauthorizedException("Invalid session");
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession(sessionId: string): Promise<SessionResponse> {
    const existingSession = await this.validateSession(sessionId);
    if (!existingSession) {
      throw new UnauthorizedException("会话无效或已过期");
    }

    try {
      const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

      const [updatedSession] = await this.db
        .update(sessions)
        .set({
          expires: newExpires,
        })
        .where(eq(sessions.id, sessionId))
        .returning();

      return this.mapToSessionResponse(updatedSession);
    } catch (error: any) {
      throw new BadRequestException(
        `会话刷新失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 删除会话（登出）
   */
  async deleteSession(input: LogoutInput): Promise<void> {
    const validatedInput = logoutSchema.parse(input);

    if (!validatedInput.sessionId) {
      throw new BadRequestException("会话 ID 不能为空");
    }

    try {
      const result = await this.db
        .delete(sessions)
        .where(eq(sessions.id, validatedInput.sessionId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException("会话不存在");
      }

      // 同时清除缓存
      this.sessionCacheService.delete(validatedInput.sessionId);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `登出失败: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(userId: number): Promise<UserResponse | null> {
    try {
      const db = this.db;
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return result[0] ? this.mapToUserResponse(result[0]) : null;
    } catch (error: any) {
      throw new BadRequestException(
        `获取用户失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 更新用户信息
   */
  async updateUser(
    userId: number,
    updateData: { name?: string; email?: string; image?: string }
  ): Promise<UserResponse> {
    try {
      const db = this.db;
      const [updatedUser] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new NotFoundException("用户不存在");
      }

      return this.mapToUserResponse(updatedUser);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `更新用户失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId: number): Promise<SessionResponse[]> {
    try {
      const result = await this.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId));

      return result.map((session) => this.mapToSessionResponse(session));
    } catch (error: any) {
      throw new BadRequestException(
        `获取用户会话失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 删除用户的所有会话
   */
  async deleteAllUserSessions(userId: number): Promise<number> {
    try {
      // 获取用户的所有会话ID，用于清除缓存
      const userSessions = await this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));

      // 删除数据库中的会话
      const result = await this.db
        .delete(sessions)
        .where(eq(sessions.userId, userId))
        .returning();

      // 清除所有相关的缓存
      userSessions.forEach((session) => {
        this.sessionCacheService.delete(session.id);
      });

      return result.length;
    } catch (error: any) {
      throw new BadRequestException(
        `删除用户会话失败: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * 将数据库用户对象映射为响应对象
   */
  private mapToUserResponse(user: SelectUser): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * 将数据库会话对象映射为响应对象
   */
  private mapToSessionResponse(session: SelectSession): SessionResponse {
    return {
      id: session.id,
      userId: session.userId,
      expires: session.expires.toISOString(),
      createdAt: session.createdAt.toISOString(),
    };
  }
}
