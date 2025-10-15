import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import { createId } from "@paralleldrive/cuid2";
import { GitHub, GitLab } from "arctic";
import { eq } from "drizzle-orm";
import { useStorage } from "nitropack/runtime";
import { Argon2id } from "oslo/password";
import type { Config } from "../../../config/configuration";
import { DrizzleService } from "../../../drizzle/drizzle.service";
import * as schema from "../../../drizzle/schemas";
import type { NewUser, User } from "../../../drizzle/schemas/users";

export interface SessionData {
  userId: string;
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly github: GitHub;
  private readonly gitlab: GitLab;
  private readonly argon2id = new Argon2id();

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly drizzleService: DrizzleService
  ) {
    // 调试：检查 ConfigService 是否可用
    if (!this.configService) {
      throw new Error("ConfigService is not available in AuthService constructor");
    }

    // 获取 OAuth 配置
    const githubConfig = this.configService.get("oauth.github", { infer: true });
    const gitlabConfig = this.configService.get("oauth.gitlab", { infer: true });

    // 调试：输出配置信息
    console.log("GitHub config:", githubConfig);
    console.log("GitLab config:", gitlabConfig);

    if (!githubConfig?.clientId || !githubConfig?.clientSecret || !githubConfig?.redirectUri) {
      throw new Error("GitHub OAuth configuration is missing or incomplete");
    }

    if (!gitlabConfig?.clientId || !gitlabConfig?.clientSecret || !gitlabConfig?.redirectUri) {
      throw new Error("GitLab OAuth configuration is missing or incomplete");
    }

    this.github = new GitHub(
      githubConfig.clientId,
      githubConfig.clientSecret,
      githubConfig.redirectUri
    );

    this.gitlab = new GitLab(
      gitlabConfig.clientId,
      gitlabConfig.clientSecret,
      gitlabConfig.redirectUri,
      gitlabConfig.baseUrl || "https://gitlab.com"
    );
  }

  // === OAuth 2.0 流程 ===
  async createGitHubAuthorizationURL(): Promise<{
    url: URL;
    state: string;
    codeVerifier: string;
  }> {
    const state = createId();
    const codeVerifier = createId();
    const url = await this.github.createAuthorizationURL(state, ["user:email"]);
    return { url, state, codeVerifier };
  }

  async getGitHubLoginUrl(): Promise<string> {
    const { url } = await this.createGitHubAuthorizationURL();
    return url.toString();
  }

  async createGitLabAuthorizationURL(): Promise<{
    url: URL;
    state: string;
    codeVerifier: string;
  }> {
    const state = createId();
    const codeVerifier = createId();
    const url = await this.gitlab.createAuthorizationURL(state, ["read_user"]);
    return { url, state, codeVerifier };
  }

  async getGitLabLoginUrl(): Promise<string> {
    const { url } = await this.createGitLabAuthorizationURL();
    return url.toString();
  }

  async validateGitHubCallback(
    code: string,
    codeVerifier: string
  ): Promise<any> {
    const tokens = await this.github.validateAuthorizationCode(code);

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    return await response.json();
  }

  async validateGitLabCallback(
    code: string,
    codeVerifier: string
  ): Promise<any> {
    const tokens = await this.gitlab.validateAuthorizationCode(code);

    // 使用配置的 GitLab 实例 URL
    const gitlabBaseUrl =
      this.configService.get("oauth.gitlab.baseUrl", { infer: true }) ||
      "https://gitlab.com";
    const response = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    return await response.json();
  }

  // === 会话管理 ===
  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    const sessionId = createId();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天

    const sessionData: SessionData = {
      userId,
      createdAt: Date.now(),
      expiresAt,
      userAgent,
      ipAddress,
    };

    // 存储到 Redis
    const storage = useStorage("redis");
    await storage.setItem(`session:${sessionId}`, sessionData, {
      ttl: 7 * 24 * 60 * 60, // 7 天（秒）
    });

    return sessionId;
  }

  async validateSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null;

    const storage = useStorage("redis");
    const sessionData = await storage.getItem<SessionData>(
      `session:${sessionId}`
    );

    if (!sessionData) return null;
    if (sessionData.expiresAt < Date.now()) {
      await this.destroySession(sessionId);
      return null;
    }

    return sessionData;
  }

  async destroySession(sessionId: string): Promise<void> {
    const storage = useStorage("redis");
    await storage.removeItem(`session:${sessionId}`);
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const storage = useStorage("redis");
    const keys = await storage.getKeys("session:*");

    for (const key of keys) {
      const sessionData = await storage.getItem<SessionData>(key);
      if (sessionData?.userId === userId) {
        await storage.removeItem(key);
      }
    }
  }

  // === 密码认证 ===
  async hashPassword(password: string): Promise<string> {
    return await this.argon2id.hash(password);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return await this.argon2id.verify(hash, password);
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await this.drizzleService.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) return null;

    const credential =
      await this.drizzleService.db.query.userCredentials.findFirst({
        where: eq(schema.userCredentials.userId, user.id),
      });

    if (!credential?.passwordHash) return null;

    const isValid = await this.verifyPassword(
      credential.passwordHash,
      password
    );
    return isValid ? user : null;
  }

  // === OAuth 账户管理 ===
  async upsertOAuthAccountAndUser(
    provider: string,
    providerUserId: string,
    profile: any
  ) {
    // 直接使用 drizzleService.db 进行数据库操作
    // 这里需要实现具体的 OAuth 账户创建逻辑
    // 暂时返回 null，需要根据实际业务逻辑实现
    return null;
  }

  // === 安全工具 ===
  generateSecureToken(): string {
    return createId();
  }

  constantTimeCompare(a: string, b: string): boolean {
    const bufferA = new TextEncoder().encode(a);
    const bufferB = new TextEncoder().encode(b);
    return constantTimeEqual(bufferA, bufferB);
  }

  // === 向后兼容方法（用于 TRPC 路由） ===
  async validateUser(email: string, password: string): Promise<User | null> {
    return await this.validateCredentials(email, password);
  }

  async getCurrentUser(sessionId: string): Promise<User | null> {
    const sessionData = await this.validateSession(sessionId);
    if (!sessionData) return null;

    const user = await this.drizzleService.db.query.users.findFirst({
      where: eq(schema.users.id, sessionData.userId),
    });
    return user ?? null;
  }

  async validateRequest(authHeader?: string): Promise<User | null> {
    // 这个方法现在主要用于向后兼容，实际会话验证在中间件中处理
    return null;
  }

  async validateToken(token: string): Promise<User | null> {
    const sessionData = await this.validateSession(token);
    if (!sessionData) {
      return null;
    }

    const user = await this.drizzleService.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, sessionData.userId))
      .limit(1);

    return user[0] || null;
  }

  async login(
    email: string,
    password: string
  ): Promise<{ user: User; sessionId: string } | null> {
    const user = await this.validateCredentials(email, password);
    if (!user) {
      return null;
    }

    const sessionId = await this.createSession(user.id);
    return { user, sessionId };
  }

  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<{ user: User; sessionId: string } | null> {
    try {
      // Check if user already exists
      const existingUser = await this.drizzleService.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return null; // User already exists
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create user
      const safeName = (name ?? "").trim();
      const [localPart] = email.split("@");
      const baseName = localPart ?? email;
      const finalName: string = safeName.length > 0 ? safeName : baseName;

      const newUserData: NewUser = {
        email,
        name: finalName,
      };

      const createdUsers = await this.drizzleService.db
        .insert(schema.users)
        .values(newUserData)
        .returning();

      const userRow = createdUsers[0];
      if (!userRow) {
        return null;
      }

      // Create user credentials with password hash
      await this.drizzleService.db.insert(schema.userCredentials).values({
        userId: userRow.id,
        passwordHash: hashedPassword,
      });

      // Create session
      const sessionId = await this.createSession(userRow.id);
      return { user: userRow, sessionId };
    } catch (error) {
      console.error("Registration error:", error);
      return null;
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.destroySession(sessionId);
  }
}
