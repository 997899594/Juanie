import { Module } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { SecurityPoliciesService } from './security-policies.service';
import { SecurityPoliciesRouter } from './security-policies.router';

@Module({
  providers: [SecurityPoliciesService, SecurityPoliciesRouter, TrpcService],
  exports: [SecurityPoliciesService, SecurityPoliciesRouter],
})
export class SecurityPoliciesModule {}