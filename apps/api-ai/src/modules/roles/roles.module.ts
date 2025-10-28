import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RolesService } from './roles.service';
import { RolesRouter } from './roles.router';

@Module({
  providers: [RolesService, RolesRouter, TrpcService],
  exports: [RolesService, RolesRouter]
})
export class RolesModule {}