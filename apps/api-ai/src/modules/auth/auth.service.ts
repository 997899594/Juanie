import { Injectable, Logger, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, or, desc, lt, isNull } from 'drizzle-orm';
import { GitLab } from 'arctic';
import { generateRandomString, alphabet, sha256 } from 'oslo/crypto';
import { encodeBase64url } from 'oslo/encoding';
import { 
  users, 
  User, 
  NewUser,
  insertUserSchema 
} from '../../database/schemas/users.schema';
import {
  authSessions,
  AuthSession,
  NewAuthSession,
  insertAuthSessionSchema
} from '../../database/schemas/auth-sessions.schema';
import {
  oauthAccounts,
  OAuthAccount,
  NewOAuthAccount,
  insertOAuthAccountSchema
} from '../../database/schemas/oauth-accounts.schema';
import {
  oauthFlows,
  OAuthFlow,
  NewOAuthFlow,
  insertOAuthFlowSchema
} from '../../database/schemas/oauth-flows.schema';

export interface OAuthState {
  provider: 'gitlab' | 'github';
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

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface AuthResult {
  user: User;
  session: AuthSession;
  accessToken?: string;
}

// 全局状态存储（生产环境应使用Redis）
declare global {
  var oauthStates: Map<string, OAuthState> | undefined;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private gitlab?: GitLab;

  constructor(
    private readonly configService: ConfigService, 
    @InjectDatabase() private readonly db: Database
  ) {
    this.initializeOAuthProviders();
    this.initializeGlobalState();
  }

  /**
   * 根据用户ID获取用户信息
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user || null;
    } catch (error) {
      this.logger.error(`Failed to get user by ID: ${error}`);
      return null;
    }
  }

  /**
   * Hello method for testing
   */
  hello(): string {
    return 'Hello from Auth Service';
  }

  private initializeOAuthProviders() {
    const gitlabClientId = this.configService.get<string>('GITLAB_CLIENT_ID');
    const gitlabClientSecret = this.configService.get<string>('GITLAB_CLIENT_SECRET');
    const gitlabRedirectUri = this.configService.get<string>('GITLAB_REDIRECT_URI') || 'http://localhost:3000/auth/gitlab/callback';
    const gitlabBaseUrl = this.configService.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com';

    if (gitlabClientId && gitlabClientSecret) {
      this.gitlab = new GitLab(
        gitlabBaseUrl,
        gitlabClientId,
        gitlabClientSecret,
        gitlabRedirectUri
      );
    }
  }

  private initializeGlobalState() {
    if (!globalThis.oauthStates) {
      globalThis.oauthStates = new Map();
    }
  }

  /**
   * 创建GitLab OAuth授权URL
   */
  async createGitLabAuthUrl(redirectTo?: string): Promise<{ url: string; state: string }> {
    if (!this.gitlab) {
      throw new BadRequestException('GitLab OAuth not configured');
    }

    try {
      const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const codeVerifier = generateRandomString(128, alphabet("a-z", "A-Z", "0-9", "-", "_"));
      
      // 存储OAuth流程状态到数据库
      const oauthFlow: NewOAuthFlow = {
        provider: 'gitlab',
        state,
        codeVerifier,
        redirectUri: this.configService.get<string>('GITLAB_REDIRECT_URI') || 'http://localhost:3000/auth/gitlab/callback',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟过期
      };

      await this.db.insert(oauthFlows).values(oauthFlow);

      // 同时存储到内存中（临时方案）
      const oauthState: OAuthState = {
        provider: 'gitlab',
        codeVerifier,
        state,
        redirectTo,
      };
      globalThis.oauthStates!.set(state, oauthState);

      const url = await this.gitlab.createAuthorizationURL(state, [
        'read_user', 'read_api', 'read_repository'
      ]);

      this.logger.log(`GitLab OAuth URL created for state: ${state}`);
      return { url: url.toString(), state };
    } catch (error) {
      this.logger.error(`Failed to create GitLab auth URL: ${error}`);
      throw new BadRequestException('Failed to create GitLab authorization URL');
    }
  }

  /**
   * 处理GitLab OAuth回调
   */
  async handleGitLabCallback(code: string, state: string): Promise<AuthResult> {
    if (!this.gitlab) {
      throw new BadRequestException('GitLab OAuth not configured');
    }

    try {
      // 验证OAuth流程状态
      const [oauthFlow] = await this.db
        .select()
        .from(oauthFlows)
        .where(and(
          eq(oauthFlows.state, state),
          eq(oauthFlows.provider, 'gitlab'),
          isNull(oauthFlows.usedAt)
        ))
        .limit(1);

      if (!oauthFlow || oauthFlow.expiresAt! < new Date()) {
        throw new UnauthorizedException('Invalid or expired OAuth state');
      }

      // 交换授权码获取令牌
      const tokens = await this.gitlab.validateAuthorizationCode(code);
      
      // 获取GitLab用户信息
      const gitlabUser = await this.fetchGitLabUser(tokens.accessToken());

      // 查找或创建用户
      let user = await this.findUserByOAuthAccount('gitlab', gitlabUser.id.toString());
      
      if (!user) {
        // 创建新用户
        const newUser: NewUser = {
          email: gitlabUser.email,
          username: gitlabUser.username,
          displayName: gitlabUser.name,
          avatarUrl: gitlabUser.avatar_url,
        };

        [user] = await this.db.insert(users).values(newUser).returning();
        this.logger.log(`New user created: ${user.id} from GitLab`);
      }

      // 创建或更新OAuth账户
      await this.upsertOAuthAccount({
        userId: user.id,
        provider: 'gitlab',
        providerAccountId: gitlabUser.id.toString(),
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken?.() || null,
        tokenType: 'bearer',
        scope: 'read_user read_api read_repository',
        expiresAt: tokens.accessTokenExpiresAt() || null,
        gitlabData: gitlabUser,
      });

      // 创建会话
      const session = await this.createSession(user.id);

      // 标记OAuth流程为已使用
      await this.db
        .update(oauthFlows)
        .set({ usedAt: new Date() })
        .where(eq(oauthFlows.id, oauthFlow.id));

      // 清理内存状态
      globalThis.oauthStates?.delete(state);

      this.logger.log(`GitLab OAuth callback processed for user: ${user.id}`);
      return {
        user,
        session,
        accessToken: tokens.accessToken(),
      };
    } catch (error) {
      this.logger.error(`GitLab OAuth callback failed: ${error}`);
      throw new BadRequestException(`GitLab OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取GitLab用户信息
   */
  private async fetchGitLabUser(accessToken: string): Promise<GitLabUser> {
    const gitlabBaseUrl = this.configService.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com';
    
    try {
      const response = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
      }

      const userData = await response.json();
      return userData as GitLabUser;
    } catch (error) {
      this.logger.error(`Failed to fetch GitLab user: ${error}`);
      throw new BadRequestException('Failed to fetch GitLab user information');
    }
  }

  /**
   * 根据OAuth账户查找用户
   */
  private async findUserByOAuthAccount(provider: string, providerAccountId: string): Promise<User | null> {
    try {
      const [result] = await this.db
        .select({ user: users })
        .from(users)
        .innerJoin(oauthAccounts, eq(users.id, oauthAccounts.userId))
        .where(and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId)
        ))
        .limit(1);

      return result?.user || null;
    } catch (error) {
      this.logger.error(`Failed to find user by OAuth account: ${error}`);
      return null;
    }
  }

  /**
   * 创建或更新OAuth账户
   */
  private async upsertOAuthAccount(accountData: Partial<NewOAuthAccount>): Promise<OAuthAccount> {
    try {
      // 先尝试查找现有账户
      const [existingAccount] = await this.db
        .select()
        .from(oauthAccounts)
        .where(and(
          eq(oauthAccounts.provider, accountData.provider!),
          eq(oauthAccounts.providerAccountId, accountData.providerAccountId!)
        ))
        .limit(1);

      if (existingAccount) {
        // 更新现有账户
        const [updatedAccount] = await this.db
          .update(oauthAccounts)
          .set({
            ...accountData,
            updatedAt: new Date(),
            lastUsedAt: new Date(),
          })
          .where(eq(oauthAccounts.id, existingAccount.id))
          .returning();

        return updatedAccount;
      } else {
        // 创建新账户
        const [newAccount] = await this.db
          .insert(oauthAccounts)
          .values({
            ...accountData,
            lastUsedAt: new Date(),
          } as NewOAuthAccount)
          .returning();

        return newAccount;
      }
    } catch (error) {
      this.logger.error(`Failed to upsert OAuth account: ${error}`);
      throw new BadRequestException('Failed to manage OAuth account');
    }
  }

  /**
   * 创建用户会话
   */
  async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<AuthSession> {
    try {
      const sessionToken = generateRandomString(32, alphabet('a-z', 'A-Z', '0-9'));
      const refreshToken = generateRandomString(32, alphabet('a-z', 'A-Z', '0-9'));
      
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));
      const refreshTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(refreshToken)));

      const sessionData: NewAuthSession = {
        userId,
        sessionTokenHash,
        refreshTokenHash,
        accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
        lastUsedAt: new Date(),
        ipAddress,
        userAgent,
      };

      const [session] = await this.db
        .insert(authSessions)
        .values(sessionData)
        .returning();

      this.logger.log(`Session created for user: ${userId}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create session: ${error}`);
      throw new BadRequestException('Failed to create session');
    }
  }

  /**
   * 验证会话
   */
  async validateSession(sessionToken: string): Promise<{ user: User; session: AuthSession } | null> {
    try {
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));

      const [result] = await this.db
        .select({
          session: authSessions,
          user: users,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(and(
          eq(authSessions.sessionTokenHash, sessionTokenHash),
          isNull(authSessions.revokedAt)
        ))
        .limit(1);

      if (!result || result.session.accessExpiresAt! < new Date()) {
        return null;
      }

      // 更新最后使用时间
      await this.db
        .update(authSessions)
        .set({ 
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.id, result.session.id));

      return {
        user: result.user,
        session: result.session,
      };
    } catch (error) {
      this.logger.error(`Failed to validate session: ${error}`);
      return null;
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession(refreshToken: string): Promise<AuthSession | null> {
    try {
      const refreshTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(refreshToken)));

      const [session] = await this.db
        .select()
        .from(authSessions)
        .where(and(
          eq(authSessions.refreshTokenHash, refreshTokenHash),
          isNull(authSessions.revokedAt)
        ))
        .limit(1);

      if (!session || session.refreshExpiresAt! < new Date()) {
        return null;
      }

      // 生成新的访问令牌
      const newSessionToken = generateRandomString(32, alphabet('a-z', 'A-Z', '0-9'));
      const newSessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(newSessionToken)));

      const [updatedSession] = await this.db
        .update(authSessions)
        .set({
          sessionTokenHash: newSessionTokenHash,
          accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.id, session.id))
        .returning();

      this.logger.log(`Session refreshed: ${session.id}`);
      return updatedSession;
    } catch (error) {
      this.logger.error(`Failed to refresh session: ${error}`);
      return null;
    }
  }

  /**
   * 撤销会话（登出）
   */
  async revokeSession(sessionToken: string): Promise<void> {
    try {
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));

      await this.db
        .update(authSessions)
        .set({ 
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authSessions.sessionTokenHash, sessionTokenHash));

      this.logger.log(`Session revoked`);
    } catch (error) {
      this.logger.error(`Failed to revoke session: ${error}`);
      throw new BadRequestException('Failed to revoke session');
    }
  }

  /**
   * 撤销用户的所有会话
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      await this.db
        .update(authSessions)
        .set({ 
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt)
        ));

      this.logger.log(`All sessions revoked for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke all user sessions: ${error}`);
      throw new BadRequestException('Failed to revoke all sessions');
    }
  }

  /**
   * 获取用户的活跃会话
   */
  async getUserActiveSessions(userId: string): Promise<AuthSession[]> {
    try {
      return await this.db
        .select()
        .from(authSessions)
        .where(and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt)
        ))
        .orderBy(desc(authSessions.lastUsedAt));
    } catch (error) {
      this.logger.error(`Failed to get user active sessions: ${error}`);
      throw new BadRequestException('Failed to get user sessions');
    }
  }

  /**
   * 清理过期的OAuth流程
   */
  async cleanupExpiredOAuthFlows(): Promise<void> {
    try {
      const result = await this.db
        .delete(oauthFlows)
        .where(lt(oauthFlows.expiresAt, new Date()));

      this.logger.log(`Cleaned up expired OAuth flows`);
    } catch (error) {
      this.logger.error(`Failed to cleanup expired OAuth flows: ${error}`);
    }
  }

  /**
   * 清理过期的会话
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.db
        .update(authSessions)
        .set({ 
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          lt(authSessions.refreshExpiresAt, new Date()),
          isNull(authSessions.revokedAt)
        ));

      this.logger.log(`Cleaned up expired sessions`);
    } catch (error) {
      this.logger.error(`Failed to cleanup expired sessions: ${error}`);
    }
  }
}