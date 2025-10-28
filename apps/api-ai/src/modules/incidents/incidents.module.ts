import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { IncidentsService } from './incidents.service';
import { IncidentsRouter } from './incidents.router';

@Module({
  imports: [DatabaseModule],
  providers: [IncidentsService, IncidentsRouter, TrpcService],
  exports: [IncidentsService, IncidentsRouter],
})
export class IncidentsModule {}