import { type EnvironmentPolicySnapshot, evaluateEnvironmentPolicy } from '@/lib/policies/delivery';

interface EnvironmentViewLike {
  isProduction?: boolean | null;
  isPreview?: boolean | null;
}

export interface EnvironmentListDecorations {
  policy: EnvironmentPolicySnapshot;
}

export function decorateEnvironmentList<T extends EnvironmentViewLike>(
  environments: T[]
): Array<T & EnvironmentListDecorations> {
  return environments.map((environment) => ({
    ...environment,
    policy: evaluateEnvironmentPolicy(environment),
  }));
}
