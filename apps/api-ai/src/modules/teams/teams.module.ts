import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TeamsService } from './teams.service';

@Module({
  imports: [DatabaseModule],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}