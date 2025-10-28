import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { PipelinesService } from './pipelines.service';
import { PipelinesRouter } from './pipelines.router';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PipelinesService, PipelinesRouter, TrpcService],
  exports: [PipelinesService, PipelinesRouter],
})
export class PipelinesModule {}