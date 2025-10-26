import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [DatabaseModule],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}