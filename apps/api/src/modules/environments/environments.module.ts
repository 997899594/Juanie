import { Module } from '@nestjs/common'
import { EnvironmentsRouter } from './environments.router'
import { EnvironmentsService } from './environments.service'

@Module({
  providers: [EnvironmentsService, EnvironmentsRouter],
  exports: [EnvironmentsService, EnvironmentsRouter],
})
export class EnvironmentsModule {}
