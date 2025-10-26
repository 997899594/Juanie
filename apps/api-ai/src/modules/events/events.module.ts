import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EventsService } from './events.service';

@Module({
  imports: [DatabaseModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}