import { Module } from '@nestjs/common'
import { TemplatesRouter } from './templates.router'
import { TemplatesService } from './templates.service'

@Module({
  providers: [TemplatesService, TemplatesRouter],
  exports: [TemplatesService],
})
export class TemplatesModule {}
