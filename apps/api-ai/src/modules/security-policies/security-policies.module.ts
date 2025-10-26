import { Module } from '@nestjs/common';
import { TrpcModule } from '../../trpc/trpc.module';
import { SecurityPoliciesService } from './security-policies.service';

@Module({
  imports: [TrpcModule],
  providers: [SecurityPoliciesService],
  exports: [SecurityPoliciesService],
})
export class SecurityPoliciesModule {}