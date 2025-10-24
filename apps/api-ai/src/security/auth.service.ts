/**
 * 🚀 Juanie AI - 认证服务
 * 集成多种认证方式和安全机制
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as speakeasy from "speakeasy";
import { z } from "zod";
import {
  CONSTANTS,
  getBooleanEnvVar,
  getEnvVar,
  getNumberEnvVar,
  hashString,
  randomString,
} from "../core";
import { QuantumCryptoService } from "../core/quantum-crypto";
import { ZeroTrustService } from "./zero-trust.service";

// ============================================================================
// 认证Schema
// ============================================================================

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().default(false),
  deviceInfo: z
    .object({
      type: z.enum(["desktop", "mobile", "tablet"]),
      name: z.string().optional(),
      fingerprint: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      ipAddress: z.string().ip().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain uppercase, lowercase, number and special character"
    ),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  organizationId: z.string().uuid().optional(),
  inviteCode: z.string().optional(),
});

export const MFASetupRequestSchema = z.object({
  userId: z.string().uuid(),
  method: z.enum(["totp", "sms", "email", "biometric"]),
  phoneNumber: z.string().optional(),
  backupCodes: z.boolean().default(true),
});

export const MFAVerifyRequestSchema = z.object({
  userId: z.string().uuid(),
  method: z.enum(["totp", "sms", "email", "biometric", "backup"]),
  code: z.string().min(4).max(10),
  sessionId: z.string().uuid().optional(),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
  captcha: z.string().optional(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(32),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
  deviceFingerprint: z.string().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type MFASetupRequest = z.infer<typeof MFASetupRequestSchema>;
export type MFAVerifyRequest = z.infer<typeof MFAVerifyRequestSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

// ============================================================================
// JWT载荷接口
// ============================================================================

export interface JwtPayload {
  sub: string; // 用户ID
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  deviceFingerprint?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
    mfaEnabled: boolean;
    lastLogin: Date;
  };
  requiresMFA?: boolean;
  mfaMethods?: string[];
  sessionId: string;
}

// ============================================================================
// 用户接口（简化版，实际应该从数据库模型导入）
// ============================================================================

interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
  phoneNumber?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 认证服务
// ============================================================================

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly saltRounds = getNumberEnvVar("BCRYPT_SALT_ROUNDS", 12);
  private readonly maxLoginAttempts = getNumberEnvVar("MAX_LOGIN_ATTEMPTS", 5);
  private readonly lockoutDuration = getNumberEnvVar(
    "LOCKOUT_DURATION",
    900000
  ); // 15分钟
  private readonly jwtExpiresIn = getEnvVar("JWT_EXPIRES_IN", "24h");
  private readonly refreshTokenExpiresIn = getEnvVar(
    "REFRESH_TOKEN_EXPIRES_IN",
    "7d"
  );

  // 内存存储（实际应该使用数据库）
  private users: Map<string, User> = new Map();
  private refreshTokens: Map<
    string,
    {
      userId: string;
      deviceFingerprint?: string;
      expiresAt: Date;
      createdAt: Date;
    }
  > = new Map();

  // 密码重置令牌
  private resetTokens: Map<
    string,
    {
      userId: string;
      expiresAt: Date;
      used: boolean;
    }
  > = new Map();

  // 统计信息
  private stats = {
    totalLogins: 0,
    successfulLogins: 0,
    failedLogins: 0,
    mfaVerifications: 0,
    passwordResets: 0,
    registrations: 0,
  };

  constructor(
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
    private zeroTrustService: ZeroTrustService,
    private quantumCrypto: QuantumCryptoService
  ) {}

  /**
   * 用户注册
   */
  async register(request: RegisterRequest): Promise<AuthResult> {
    try {
      this.logger.debug(`Registration attempt for email: ${request.email}`);

      // 检查用户是否已存在
      const existingUser = Array.from(this.users.values()).find(
        (user) => user.email === request.email
      );

      if (existingUser) {
        throw new BadRequestException("User already exists");
      }

      // 密码哈希
      const passwordHash = await bcrypt.hash(request.password, this.saltRounds);

      // 创建用户
      const user: User = {
        id: crypto.randomUUID(),
        email: request.email,
        passwordHash,
        firstName: request.firstName,
        lastName: request.lastName,
        roles: ["user"], // 默认角色
        permissions: ["read:profile", "update:profile"],
        mfaEnabled: false,
        emailVerified: false,
        phoneVerified: false,
        isActive: true,
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(user.id, user);
      this.stats.registrations++;

      // 发送验证邮件（模拟）
      this.eventEmitter.emit("auth.user.registered", {
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
      });

      // 自动登录
      const authResult = await this.createAuthResult(user);

      this.logger.log(`User registered successfully: ${user.email}`);
      return authResult;
    } catch (error) {
      this.logger.error("Registration failed", error);
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(request: LoginRequest): Promise<AuthResult> {
    try {
      this.stats.totalLogins++;

      this.logger.debug(`Login attempt for email: ${request.email}`);

      // 查找用户
      const user = Array.from(this.users.values()).find(
        (u) => u.email === request.email
      );

      if (!user) {
        this.stats.failedLogins++;
        throw new UnauthorizedException("Invalid credentials");
      }

      // 检查账户锁定
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException("Account is temporarily locked");
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(
        request.password,
        user.passwordHash
      );

      if (!isPasswordValid) {
        await this.handleFailedLogin(user);
        this.stats.failedLogins++;
        throw new UnauthorizedException("Invalid credentials");
      }

      // 重置登录尝试次数
      user.loginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLogin = new Date();
      user.updatedAt = new Date();

      this.stats.successfulLogins++;

      // 零信任评估
      if (request.location || request.deviceInfo) {
        const accessRequest = {
          userId: user.id,
          sessionId: crypto.randomUUID(),
          resource: "auth:login",
          action: "authenticate",
          context: {
            userAgent: request.deviceInfo?.userAgent,
            ipAddress: request.location?.ipAddress,
            location: request.location,
            device: request.deviceInfo,
            timestamp: new Date(),
          },
        };

        const decision = await this.zeroTrustService.evaluateAccess(
          accessRequest
        );

        if (decision.decision === "deny") {
          throw new UnauthorizedException("Access denied by security policy");
        }

        if (decision.decision === "challenge" || user.mfaEnabled) {
          // 返回需要MFA验证的响应
          const tempToken = this.jwtService.sign(
            { sub: user.id, type: "mfa_pending" },
            { expiresIn: "10m" }
          );

          return {
            accessToken: tempToken,
            refreshToken: "",
            expiresIn: 600, // 10分钟
            tokenType: "Bearer",
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              roles: user.roles,
              permissions: user.permissions,
              mfaEnabled: user.mfaEnabled,
              lastLogin: user.lastLogin!,
            },
            requiresMFA: true,
            mfaMethods: this.getAvailableMFAMethods(user),
            sessionId: accessRequest.sessionId,
          };
        }
      }

      // 创建认证结果
      const authResult = await this.createAuthResult(
        user,
        request.deviceInfo?.fingerprint
      );

      // 发送登录事件
      this.eventEmitter.emit("auth.user.login", {
        userId: user.id,
        email: user.email,
        deviceInfo: request.deviceInfo,
        location: request.location,
        timestamp: new Date(),
      });

      this.logger.log(`User logged in successfully: ${user.email}`);
      return authResult;
    } catch (error) {
      this.logger.error("Login failed", error);
      throw error;
    }
  }

  /**
   * MFA验证
   */
  async verifyMFA(request: MFAVerifyRequest): Promise<AuthResult> {
    try {
      this.logger.debug(`MFA verification for user: ${request.userId}`);

      const user = this.users.get(request.userId);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      let isValid = false;

      switch (request.method) {
        case "totp":
          isValid = this.verifyTOTP(user, request.code);
          break;
        case "backup":
          isValid = await this.verifyBackupCode(user, request.code);
          break;
        case "sms":
        case "email":
          // 实际实现中应该验证发送的验证码
          isValid = request.code === "123456"; // 模拟验证
          break;
        case "biometric":
          // 生物识别验证（需要客户端支持）
          isValid = await this.verifyBiometric(user, request.code);
          break;
      }

      if (!isValid) {
        this.stats.failedLogins++;
        throw new UnauthorizedException("Invalid MFA code");
      }

      this.stats.mfaVerifications++;

      // 创建完整的认证结果
      const authResult = await this.createAuthResult(user);

      this.eventEmitter.emit("auth.mfa.verified", {
        userId: user.id,
        method: request.method,
        timestamp: new Date(),
      });

      this.logger.log(`MFA verified successfully for user: ${user.email}`);
      return authResult;
    } catch (error) {
      this.logger.error("MFA verification failed", error);
      throw error;
    }
  }

  /**
   * 设置MFA
   */
  async setupMFA(request: MFASetupRequest): Promise<{
    secret?: string;
    qrCode?: string;
    backupCodes?: string[];
  }> {
    try {
      const user = this.users.get(request.userId);
      if (!user) {
        throw new BadRequestException("User not found");
      }

      const result: any = {};

      switch (request.method) {
        case "totp": {
          const secret = speakeasy.generateSecret({
            name: `Juanie AI (${user.email})`,
            issuer: "Juanie AI",
          });

          user.mfaSecret = secret.base32;
          result.secret = secret.base32;
          result.qrCode = secret.otpauth_url;
          break;
        }

        case "sms":
          if (!request.phoneNumber) {
            throw new BadRequestException("Phone number required for SMS MFA");
          }
          user.phoneNumber = request.phoneNumber;
          break;

        case "email":
          // 邮件MFA不需要额外设置
          break;

        case "biometric":
          // 生物识别MFA需要客户端注册
          break;
      }

      // 生成备份码
      if (request.backupCodes) {
        const backupCodes = Array.from({ length: 10 }, () =>
          randomString(8, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        );

        user.mfaBackupCodes = await Promise.all(
          backupCodes.map((code) => hashString(code, "SHA-256"))
        );

        result.backupCodes = backupCodes;
      }

      user.mfaEnabled = true;
      user.updatedAt = new Date();

      this.eventEmitter.emit("auth.mfa.setup", {
        userId: user.id,
        method: request.method,
        timestamp: new Date(),
      });

      this.logger.log(`MFA setup completed for user: ${user.email}`);
      return result;
    } catch (error) {
      this.logger.error("MFA setup failed", error);
      throw error;
    }
  }

  /**
   * 刷新令牌
   */
  async refreshToken(request: RefreshTokenRequest): Promise<AuthResult> {
    try {
      const tokenData = this.refreshTokens.get(request.refreshToken);

      if (!tokenData || tokenData.expiresAt < new Date()) {
        throw new UnauthorizedException("Invalid or expired refresh token");
      }

      const user = this.users.get(tokenData.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      // 验证设备指纹（如果提供）
      if (
        request.deviceFingerprint &&
        tokenData.deviceFingerprint !== request.deviceFingerprint
      ) {
        throw new UnauthorizedException("Device fingerprint mismatch");
      }

      // 删除旧的刷新令牌
      this.refreshTokens.delete(request.refreshToken);

      // 创建新的认证结果
      const authResult = await this.createAuthResult(
        user,
        request.deviceFingerprint
      );

      this.eventEmitter.emit("auth.token.refreshed", {
        userId: user.id,
        timestamp: new Date(),
      });

      return authResult;
    } catch (error) {
      this.logger.error("Token refresh failed", error);
      throw error;
    }
  }

  /**
   * 密码重置请求
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    try {
      const user = Array.from(this.users.values()).find(
        (u) => u.email === request.email
      );

      if (!user) {
        // 为了安全，即使用户不存在也返回成功
        this.logger.warn(
          `Password reset requested for non-existent email: ${request.email}`
        );
        return;
      }

      // 生成重置令牌
      const resetToken = randomString(64);
      const expiresAt = new Date(Date.now() + 3600000); // 1小时后过期

      this.resetTokens.set(resetToken, {
        userId: user.id,
        expiresAt,
        used: false,
      });

      // 发送重置邮件（模拟）
      this.eventEmitter.emit("auth.password.reset.requested", {
        userId: user.id,
        email: user.email,
        resetToken,
        expiresAt,
        timestamp: new Date(),
      });

      this.stats.passwordResets++;
      this.logger.log(`Password reset requested for user: ${user.email}`);
    } catch (error) {
      this.logger.error("Password reset request failed", error);
      throw error;
    }
  }

  /**
   * 确认密码重置
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<void> {
    try {
      const tokenData = this.resetTokens.get(request.token);

      if (!tokenData || tokenData.used || tokenData.expiresAt < new Date()) {
        throw new BadRequestException("Invalid or expired reset token");
      }

      const user = this.users.get(tokenData.userId);
      if (!user) {
        throw new BadRequestException("User not found");
      }

      // 更新密码
      user.passwordHash = await bcrypt.hash(
        request.newPassword,
        this.saltRounds
      );
      user.updatedAt = new Date();

      // 标记令牌为已使用
      tokenData.used = true;

      // 撤销所有刷新令牌
      for (const [token, data] of this.refreshTokens) {
        if (data.userId === user.id) {
          this.refreshTokens.delete(token);
        }
      }

      this.eventEmitter.emit("auth.password.reset.completed", {
        userId: user.id,
        timestamp: new Date(),
      });

      this.logger.log(`Password reset completed for user: ${user.email}`);
    } catch (error) {
      this.logger.error("Password reset confirmation failed", error);
      throw error;
    }
  }

  /**
   * 登出
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        this.refreshTokens.delete(refreshToken);
      } else {
        // 删除用户的所有刷新令牌
        for (const [token, data] of this.refreshTokens) {
          if (data.userId === userId) {
            this.refreshTokens.delete(token);
          }
        }
      }

      this.eventEmitter.emit("auth.user.logout", {
        userId,
        timestamp: new Date(),
      });

      this.logger.log(`User logged out: ${userId}`);
    } catch (error) {
      this.logger.error("Logout failed", error);
      throw error;
    }
  }

  /**
   * 验证JWT令牌
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 检查用户是否仍然活跃
      const user = this.users.get(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }

  /**
   * 创建认证结果
   */
  private async createAuthResult(
    user: User,
    deviceFingerprint?: string
  ): Promise<AuthResult> {
    const sessionId = crypto.randomUUID();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      sessionId,
      deviceFingerprint,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) + this.parseExpiresIn(this.jwtExpiresIn),
      iss: getEnvVar("JWT_ISSUER", "juanie-ai"),
      aud: getEnvVar("JWT_AUDIENCE", "juanie-ai-users"),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomString(64);

    // 存储刷新令牌
    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      deviceFingerprint,
      expiresAt: new Date(
        Date.now() + this.parseExpiresIn(this.refreshTokenExpiresIn) * 1000
      ),
      createdAt: new Date(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(this.jwtExpiresIn),
      tokenType: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin || new Date(),
      },
      sessionId,
    };
  }

  /**
   * 处理登录失败
   */
  private async handleFailedLogin(user: User): Promise<void> {
    user.loginAttempts++;

    if (user.loginAttempts >= this.maxLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + this.lockoutDuration);

      this.eventEmitter.emit("auth.account.locked", {
        userId: user.id,
        email: user.email,
        attempts: user.loginAttempts,
        lockedUntil: user.lockedUntil,
        timestamp: new Date(),
      });
    }

    user.updatedAt = new Date();
  }

  /**
   * 验证TOTP
   */
  private verifyTOTP(user: User, code: string): boolean {
    if (!user.mfaSecret) return false;

    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token: code,
      window: 2, // 允许前后2个时间窗口
    });
  }

  /**
   * 验证备份码
   */
  private async verifyBackupCode(user: User, code: string): Promise<boolean> {
    if (!user.mfaBackupCodes) return false;

    const hashedCode = await hashString(code, "SHA-256");
    const index = user.mfaBackupCodes.indexOf(hashedCode);

    if (index !== -1) {
      // 使用后删除备份码
      user.mfaBackupCodes.splice(index, 1);
      user.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * 验证生物识别
   */
  private async verifyBiometric(
    user: User,
    signature: string
  ): Promise<boolean> {
    try {
      // 使用量子加密服务验证生物识别签名
      return await this.quantumCrypto.verifySignatureByType(
        user.id,
        signature,
        "biometric"
      );
    } catch (error) {
      this.logger.error("Biometric verification failed", error);
      return false;
    }
  }

  /**
   * 获取可用的MFA方法
   */
  private getAvailableMFAMethods(user: User): string[] {
    const methods: string[] = [];

    if (user.mfaSecret) methods.push("totp");
    if (user.phoneNumber) methods.push("sms");
    if (user.emailVerified) methods.push("email");
    if (user.mfaBackupCodes?.length) methods.push("backup");

    // 生物识别需要设备支持
    methods.push("biometric");

    return methods;
  }

  /**
   * 解析过期时间
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // 默认1小时

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return 3600;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.totalLogins > 0
          ? this.stats.successfulLogins / this.stats.totalLogins
          : 0,
      activeUsers: Array.from(this.users.values()).filter((u) => u.isActive)
        .length,
      mfaEnabledUsers: Array.from(this.users.values()).filter(
        (u) => u.mfaEnabled
      ).length,
      activeRefreshTokens: this.refreshTokens.size,
    };
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter((u) => u.isActive)
        .length,
      lockedUsers: Array.from(this.users.values()).filter(
        (u) => u.lockedUntil && u.lockedUntil > new Date()
      ).length,
      mfaEnabledUsers: Array.from(this.users.values()).filter(
        (u) => u.mfaEnabled
      ).length,
      activeRefreshTokens: this.refreshTokens.size,
      pendingResetTokens: Array.from(this.resetTokens.values()).filter(
        (t) => !t.used && t.expiresAt > new Date()
      ).length,
      stats: this.getStats(),
    };
  }
}
