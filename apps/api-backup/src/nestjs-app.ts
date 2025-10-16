import 'reflect-metadata'
import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

let nestApp: INestApplicationContext | null = null

export async function getNestApp(): Promise<INestApplicationContext> {
  if (!nestApp) {
    // 创建应用上下文，不启动 HTTP 服务器
    nestApp = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // 禁用 NestJS 日志，使用我们自己的日志系统
    })
  }
  return nestApp
}

export async function closeNestApp(): Promise<void> {
  if (nestApp) {
    await nestApp.close()
    nestApp = null
  }
}
