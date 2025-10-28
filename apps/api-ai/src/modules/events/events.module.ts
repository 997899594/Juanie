import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { EventsService } from './events.service';
import { EventsRouter } from './events.router';

@Module({
  imports: [DatabaseModule],
  providers: [EventsService, EventsRouter, TrpcService],
  exports: [EventsService, EventsRouter],
})
export class EventsModule {}