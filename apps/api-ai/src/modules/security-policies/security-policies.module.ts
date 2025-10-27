import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { SecurityPoliciesService } from './security-policies.service';

@Module({
    providers: [SecurityPoliciesService, TrpcService],
  exports: [SecurityPoliciesService]})
export class SecurityPoliciesModule {}