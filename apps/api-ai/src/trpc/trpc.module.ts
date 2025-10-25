/**
 * tRPC 模块 - 端到端类型安全的API层
 * 集成 NestJS + tRPC + Zod 验证
 */

import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { UsersModule } from '../modules/users';
import { OrganizationsModule } from '../modules/organizations';

@Module({
  imports: [UsersModule, OrganizationsModule],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}