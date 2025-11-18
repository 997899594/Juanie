import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventBusService } from './event-bus.service'
import { SseService } from './sse.service'
import { SSEManagerService } from './sse-manager.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EventBusService, SSEManagerService, SseService],
  exports: [EventBusService, SSEManagerService, SseService],
})
export class SseModule {}
