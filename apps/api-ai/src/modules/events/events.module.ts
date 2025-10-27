import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { EventsService } from './events.service';

@Module({
  imports: [DatabaseModule],
  providers: [EventsService, TrpcService],
  exports: [EventsService],
})
export class EventsModule {}