import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [DatabaseModule],
  providers: [IncidentsService, TrpcService],
  exports: [IncidentsService],
})
export class IncidentsModule {}