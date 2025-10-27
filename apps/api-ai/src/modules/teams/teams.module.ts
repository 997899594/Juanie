import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { TeamsService } from './teams.service';

@Module({
  imports: [DatabaseModule],
  providers: [TeamsService, TrpcService],
  exports: [TeamsService],
})
export class TeamsModule {}