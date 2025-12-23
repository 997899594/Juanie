import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { SessionService } from './session.service'

@Module({
  imports: [DatabaseModule],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionsModule {}
