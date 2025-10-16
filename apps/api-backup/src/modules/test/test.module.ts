import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleModule } from '@/drizzle/drizzle.module'
import { TestService } from './test.service'

@Module({
  imports: [ConfigModule, DrizzleModule],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {}
