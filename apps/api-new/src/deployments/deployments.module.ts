import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}