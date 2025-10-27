import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { RolesService } from './roles.service';

@Module({
    providers: [RolesService, TrpcService],
  exports: [RolesService]})
export class RolesModule {}