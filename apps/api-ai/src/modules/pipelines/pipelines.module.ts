import { Module } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PipelinesService],
  exports: [PipelinesService],
})
export class PipelinesModule {}