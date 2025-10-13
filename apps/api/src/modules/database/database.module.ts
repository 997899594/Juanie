import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseService } from './services/database.service'

/**
 * 数据库模块
 * 提供数据库连接和操作功能
 */
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
