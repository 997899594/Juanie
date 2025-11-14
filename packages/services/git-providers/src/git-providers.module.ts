import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitProviderService } from './git-provider.service'

@Module({
  imports: [ConfigModule],
  providers: [GitProviderService],
  exports: [GitProviderService],
})
export class GitProvidersModule {}
