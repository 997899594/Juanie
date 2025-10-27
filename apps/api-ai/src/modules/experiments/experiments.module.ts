import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [DatabaseModule],
  providers: [ExperimentsService, TrpcService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}