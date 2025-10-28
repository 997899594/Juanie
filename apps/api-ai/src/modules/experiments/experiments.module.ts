import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { ExperimentsService } from './experiments.service';
import { ExperimentsRouter } from './experiments.router';

@Module({
  imports: [DatabaseModule],
  providers: [ExperimentsService, ExperimentsRouter, TrpcService],
  exports: [ExperimentsService, ExperimentsRouter],
})
export class ExperimentsModule {}