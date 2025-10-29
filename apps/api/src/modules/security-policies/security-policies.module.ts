import { Module } from '@nestjs/common'
import { SecurityPoliciesRouter } from './security-policies.router'
import { SecurityPoliciesService } from './security-policies.service'

@Module({
  providers: [SecurityPoliciesService, SecurityPoliciesRouter],
  exports: [SecurityPoliciesService],
})
export class SecurityPoliciesModule {}
