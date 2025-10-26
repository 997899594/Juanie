import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [DatabaseModule],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}