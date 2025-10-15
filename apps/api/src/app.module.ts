import { Module } from '@nestjs/common'
import { ConfigModule } from './core/config/nestjs'
import { DrizzleModule } from './drizzle/drizzle.module'
import { AuthModule } from './modules/auth/auth.module'
import { GitModule } from './modules/git/git.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [ConfigModule, DrizzleModule, AuthModule, GitModule, HealthModule],
})
export class AppModule {}
