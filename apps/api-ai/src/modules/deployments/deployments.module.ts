import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { DeploymentsService } from './deployments.service';
import { DeploymentsRouter } from './deployments.router';

@Module({
  imports: [DatabaseModule],
  providers: [DeploymentsService, DeploymentsRouter, TrpcService],
  exports: [DeploymentsService, DeploymentsRouter],
})
export class DeploymentsModule {}