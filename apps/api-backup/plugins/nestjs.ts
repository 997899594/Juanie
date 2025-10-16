import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { defineNitroPlugin } from 'nitropack/runtime'
import { AppModule } from '../src/app.module'

let nestApp: INestApplication | null = null

export function getNestApp(): INestApplication {
  if (!nestApp) {
    throw new Error('NestJS app not initialized')
  }
  return nestApp
}

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🚀 Initializing NestJS application...')

  try {
    // 创建完整的 NestJS 应用（包含 HTTP 服务器，但我们不会启动它）
    nestApp = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'], // 显示更多日志信息
    })

    // 初始化应用但不启动 HTTP 服务器
    await nestApp.init()

    console.log('✅ NestJS application initialized successfully')

    // 在 Nitro 关闭时清理 NestJS 应用
    nitroApp.hooks.hook('close', async () => {
      console.log('🔄 Closing NestJS application...')
      try {
        if (nestApp) {
          await nestApp.close()
          nestApp = null
        }
      } catch (error) {
        console.error('Error closing NestJS app:', error)
      }
      console.log('✅ NestJS application closed')
    })
  } catch (error) {
    console.error('❌ Failed to initialize NestJS application:', error)
    throw error
  }
})
