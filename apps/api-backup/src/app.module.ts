import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleModule } from './drizzle/drizzle.module'
import { AuthModule } from './modules/auth/auth.module'
import { GitModule } from './modules/git/git.module'
import { HealthModule } from './modules/health/health.module'
import { TestModule } from './modules/test/test.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DrizzleModule,
    AuthModule,
    GitModule,
    HealthModule,
    TestModule,
  ],
})
export class AppModule {}
