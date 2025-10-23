import { Module } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}