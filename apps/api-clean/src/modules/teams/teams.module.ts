import { Module } from '@nestjs/common'
import { TeamsRouter } from './teams.router'
import { TeamsService } from './teams.service'

@Module({
  providers: [TeamsService, TeamsRouter],
  exports: [TeamsService, TeamsRouter],
})
export class TeamsModule {}
