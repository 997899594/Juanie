import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { EventBusService } from './event-bus.service'

@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class SseModule {}
