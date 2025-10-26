/**
 * tRPC 模块 - 端到端类型安全的API层
 * 集成 NestJS + tRPC + Zod 验证
 */

import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { UsersModule } from '../modules/users/users.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AiAssistantsModule } from '../modules/ai-assistants/ai-assistants.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    AuthModule,
    AiAssistantsModule,
    WorkflowsModule,
  ],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}