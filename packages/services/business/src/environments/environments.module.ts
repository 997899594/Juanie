import { DatabaseModule } from '@juanie/core-database/module'
import { Module } from '@nestjs/common'
import { EnvironmentsService } from './environments.service'

@Module({
  imports: [DatabaseModule],
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
