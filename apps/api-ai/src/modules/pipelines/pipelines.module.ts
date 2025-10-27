import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { PipelinesService } from './pipelines.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PipelinesService, TrpcService],
  exports: [PipelinesService],
})
export class PipelinesModule {}