import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// import { drizzle } from 'drizzle-orm/postgres-js'
// import postgres from 'postgres'
// import * as schema from '~/db/schema'

// 模拟Drizzle ORM的查询构建器

// 模拟数据库对象，实现Drizzle ORM接口

@Injectable()
export class DrizzleService {
  private _db: any = 'mockDb'
  private _isConnected = true // 假装已经连接

  constructor(private readonly configService: ConfigService) {
    console.log('🎭 [MOCK] DrizzleService initialized with mock database')
  }

  /**
   * 获取数据库实例（返回模拟数据库）
   */
  getDb() {
    console.log('🎭 [MOCK] Returning mock database instance')
    return this._db
  }

  /**
   * 关闭数据库连接（模拟）
   */
  async close() {
    console.log('🎭 [MOCK] Pretending to close database connection')
    this._isConnected = false
  }

  /**
   * 检查数据库连接状态（模拟）
   */
  isConnected(): boolean {
    return this._isConnected
  }
}
