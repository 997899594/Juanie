import 'reflect-metadata'
import type { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AuthService } from './modules/auth/services/auth.service'
import { DatabaseService } from './modules/database/services/database.service'
import { GitService } from './modules/git/services/git.service'
import { HealthService } from './modules/health/services/health.service'
import { TrpcService } from './trpc/trpc.service'

export interface AppContainer {
  authService: AuthService
  databaseService: DatabaseService
  healthService: HealthService
  gitService: GitService
  trpcService: TrpcService
}

let appContainer: AppContainer | null = null

/**
 * 初始化 NestJS 应用容器
 * 创建应用实例并获取所有服务
 */
export async function initNestAppContainer(): Promise<AppContainer> {
  if (appContainer) {
    return appContainer
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  })

  appContainer = {
    authService: app.get(AuthService),
    databaseService: app.get(DatabaseService),
    healthService: app.get(HealthService),
    gitService: app.get(GitService),
    trpcService: app.get(TrpcService),
  }

  return appContainer
}

/**
 * 获取已初始化的应用容器
 */
export function getAppContainer(): AppContainer {
  if (!appContainer) {
    throw new Error('App container not initialized. Call initNestAppContainer() first.')
  }
  return appContainer
}
