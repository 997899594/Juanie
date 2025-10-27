/**
 * tRPC 模块 - 现代化的 tRPC + NestJS 集成
 * 使用官方推荐的方式，提供类型安全的 API 服务
 */

import { Global, Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { TrpcController } from './trpc.controller';

// 导入核心业务模块
import { ProjectsModule } from '../modules/projects/projects.module';

@Global()
@Module({
  imports: [
    // 导入核心业务模块以获取其路由器
    ProjectsModule,
  ],
  controllers: [TrpcController],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
