export type EnvironmentVariableScope = 'project' | 'environment' | 'service';

export interface EnvironmentVariableScopeInput {
  environmentId?: string | null;
  serviceId?: string | null;
}

export function resolveEnvironmentVariableScope(
  input: EnvironmentVariableScopeInput
): EnvironmentVariableScope {
  const environmentId = input.environmentId ?? null;
  const serviceId = input.serviceId ?? null;

  if (environmentId && serviceId) {
    throw new Error('环境变量暂不支持 environment + service 双重作用域');
  }

  if (serviceId) {
    return 'service';
  }

  if (environmentId) {
    return 'environment';
  }

  return 'project';
}
