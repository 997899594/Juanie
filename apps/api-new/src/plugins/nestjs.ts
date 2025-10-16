import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { defineNitroPlugin } from 'nitropack/runtime'
import { AppModule } from '../app.module'

let nestApp: INestApplication | null = null

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🔍 [DEBUG] NestJS plugin initializing...')

  try {
    console.log('🔍 [DEBUG] Creating NestJS application...')
    nestApp = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    })

    console.log('🔍 [DEBUG] NestJS application created successfully')
    console.log('🔍 [DEBUG] App instance:', nestApp)
    console.log('🔍 [DEBUG] App type:', typeof nestApp)

    await nestApp.init()
    console.log('✅ [DEBUG] NestJS application initialized successfully')
  } catch (error) {
    console.error('❌ [DEBUG] Failed to initialize NestJS application:', error)
    throw error
  }

  nitroApp.hooks.hook('close', async () => {
    console.log('🔍 [DEBUG] Closing NestJS application...')
    if (nestApp) {
      await nestApp.close()
      console.log('✅ [DEBUG] NestJS application closed')
    }
  })
})

export function getNestApp(): INestApplication {
  console.log('🔍 [DEBUG] getNestApp called, nestApp:', nestApp)

  if (!nestApp) {
    console.error('❌ [DEBUG] NestJS application is not initialized')
    throw new Error('NestJS application is not initialized')
  }

  console.log('✅ [DEBUG] Returning NestJS app instance')
  return nestApp
}
