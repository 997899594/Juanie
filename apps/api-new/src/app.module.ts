import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleModule } from './modules/drizzle/drizzle.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    DrizzleModule,
  ],
})
export class AppModule {
  constructor() {
    console.log('🔍 [DEBUG] AppModule constructor called')
    console.log('🔍 [DEBUG] Environment variables loaded:')
    console.log('🔍 [DEBUG] NODE_ENV:', process.env.NODE_ENV)
    console.log(
      '🔍 [DEBUG] DATABASE_URL:',
      process.env.DATABASE_URL ? '***configured***' : 'NOT SET',
    )
    console.log('🔍 [DEBUG] APP_VERSION:', process.env.APP_VERSION)
    console.log('✅ [DEBUG] AppModule initialized')
  }
}
