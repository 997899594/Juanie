import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DeploymentsService } from './deployments.service';

@Module({
  imports: [DatabaseModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}