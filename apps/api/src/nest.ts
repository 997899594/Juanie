import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AuthService } from './services/auth.service'
import { DatabaseService } from './services/database.service'
import { HealthService } from './services/health.service'
import { TrpcService } from './trpc/trpc.service'

type AppContainer = {
  healthService: HealthService
  databaseService: DatabaseService
  authService: AuthService
  trpcService: TrpcService
}

let container: AppContainer | null = null

export async function initNestAppContainer(): Promise<AppContainer> {
  if (container) return container

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })

  container = {
    healthService: app.get(HealthService),
    databaseService: app.get(DatabaseService),
    authService: app.get(AuthService),
    trpcService: app.get(TrpcService),
  }

  return container
}

export function getAppContainer(): AppContainer {
  if (!container) {
    throw new Error('Nest app container not initialized. Make sure Nitro plugin has run.')
  }
  return container
}
