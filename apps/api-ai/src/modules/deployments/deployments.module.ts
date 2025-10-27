import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [DatabaseModule],
  providers: [DeploymentsService, TrpcService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}