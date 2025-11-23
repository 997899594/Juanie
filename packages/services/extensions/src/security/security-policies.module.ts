import { Module } from '@nestjs/common'
import { SecurityPoliciesService } from './security-policies.service'

@Module({
  providers: [SecurityPoliciesService],
  exports: [SecurityPoliciesService],
})
export class SecurityPoliciesModule {}
