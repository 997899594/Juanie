import { CoreEventsModule } from '@juanie/core/events'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { K3sService } from './k3s.service'

@Global()
@Module({
  imports: [ConfigModule, CoreEventsModule],
  providers: [K3sService],
  exports: [K3sService],
})
export class K3sModule {}
