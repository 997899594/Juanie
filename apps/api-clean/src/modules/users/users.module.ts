import { Module } from '@nestjs/common'
import { UsersRouter } from './users.router'
import { UsersService } from './users.service'

@Module({
  providers: [UsersService, UsersRouter],
  exports: [UsersService, UsersRouter],
})
export class UsersModule {}
