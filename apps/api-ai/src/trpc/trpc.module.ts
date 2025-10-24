/**
 * 🚀 Juanie AI - tRPC模块
 * 下一代类型安全的API层
 */

import { Module } from '@nestjs/common';
import { TRPCServer } from './server';

@Module({
  providers: [TRPCServer],
  exports: [TRPCServer],
})
export class TRPCModule {}