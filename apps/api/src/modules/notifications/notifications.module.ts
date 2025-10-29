import { Module } from '@nestjs/common'
import { NotificationsRouter } from './notifications.router'
import { NotificationsService } from './notifications.service'

@Module({
  providers: [NotificationsService, NotificationsRouter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
