import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DatabaseModule } from '../../database/database.module';
import { TeamsService } from './teams.service';
import { TeamsRouter } from './teams.router';

@Module({
  imports: [DatabaseModule],
  providers: [TeamsService, TeamsRouter, TrpcService],
  exports: [TeamsService, TeamsRouter],
})
export class TeamsModule {}