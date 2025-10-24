/**
 * 🚀 Juanie AI - 安全模块
 * 集成零信任安全架构和量子安全认证
 */

import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { StringValue } from "ms";
// 配置
import { getBooleanEnvVar, getEnvVar } from "../core";
import { QuantumCryptoService } from "../core/quantum-crypto";
import { AuthService } from "./auth.service";

// 守卫
import { ZeroTrustGuard } from "./guards/zero-trust.guard";

// 中间件
import { SecurityHeadersMiddleware } from "./middleware/security-headers.middleware";
// 安全服务
import { ZeroTrustService } from "./zero-trust.service";

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getEnvVar("JWT_SECRET", "your-super-secret-jwt-key"),
        signOptions: {
          expiresIn: getEnvVar("JWT_EXPIRES_IN", "24h") as StringValue,
          issuer: getEnvVar("JWT_ISSUER", "juanie-ai"),
          audience: getEnvVar("JWT_AUDIENCE", "juanie-ai-users"),
        },
        verifyOptions: {
          issuer: getEnvVar("JWT_ISSUER", "juanie-ai"),
          audience: getEnvVar("JWT_AUDIENCE", "juanie-ai-users"),
        },
      }),
    }),
  ],
  providers: [
    // 核心安全服务
    ZeroTrustService,
    QuantumCryptoService,
    AuthService,

    // 守卫
    ZeroTrustGuard,

    // 中间件
    SecurityHeadersMiddleware,
  ],
  exports: [
    // 导出核心服务供其他模块使用
    ZeroTrustService,
    QuantumCryptoService,
    AuthService,
    ZeroTrustGuard,
    SecurityHeadersMiddleware,
  ],
})
export class SecurityModule {}
