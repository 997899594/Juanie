import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRouter } from './users.router';

@Module({
  imports: [DatabaseModule],
  providers: [UsersService, UsersRouter],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}