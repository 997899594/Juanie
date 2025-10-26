import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { TrpcModule } from '../../trpc/trpc.module';

@Module({
  imports: [TrpcModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}