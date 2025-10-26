/**
 * 🚀 Juanie AI - 主应用模块
 * 2025年最前沿的AI原生DevOps平台
 *
 * 集成所有前沿技术模块：
 * - AI智能体编排系统
 * - 零信任安全架构
 * - 性能优化和自动扩缩容
 * - 实时监控和智能告警
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { TrpcModule } from "./trpc/trpc.module";
import { UsersModule } from "./modules/users";
import { OrganizationsModule } from "./modules/organizations";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TeamMembersModule } from "./modules/team-members/team-members.module";
import { ProjectMembershipsModule } from "./modules/project-memberships/project-memberships.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RolesModule } from "./modules/roles/roles.module";
import { RoleAssignmentsModule } from "./modules/role-assignments/role-assignments.module";
import { IdentityProvidersModule } from "./modules/identity-providers/identity-providers.module";
import { OAuthFlowsModule } from "./modules/oauth-flows/oauth-flows.module";
import { OAuthAccountsModule } from "./modules/oauth-accounts/oauth-accounts.module";
import { AuthSessionsModule } from "./modules/auth-sessions/auth-sessions.module";
import { RepositoriesModule } from "./modules/repositories/repositories.module";
import { CodeAnalysisResultsModule } from "./modules/code-analysis-results/code-analysis-results.module";
import { VulnerabilityScansModule } from "./modules/vulnerability-scans/vulnerability-scans.module";
import { SecurityPoliciesModule } from "./modules/security-policies/security-policies.module";
import { EnvironmentsModule } from "./modules/environments/environments.module";

@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      cache: true,
    }),

    // 数据库模块
    DatabaseModule,

    // tRPC API模块
    TrpcModule,

    // 核心业务模块
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    TeamMembersModule,
    ProjectMembershipsModule,

    // 已实现的认证授权模块
    AuthModule,
    RolesModule,
    RoleAssignmentsModule,
    IdentityProvidersModule,
    OAuthFlowsModule,
    OAuthAccountsModule,
    AuthSessionsModule,

    // 已实现的代码管理模块
    RepositoriesModule,
    CodeAnalysisResultsModule,
    VulnerabilityScansModule,

    // 安全策略模块
    SecurityPoliciesModule,

    // 部署运维模块
    EnvironmentsModule,

    // 部署运维模块 (待实现)
    // EnvironmentsModule,
    // DeploymentsModule,
    // MonitoringModule,

    // 事件处理模块 (待实现)
    // EventsModule,
    // IncidentsModule,

    // AI智能模块 (待实现)
    // AIModule,

    // 成本审计模块 (待实现)
    // CostModule,
    // AuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
