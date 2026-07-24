export interface ServiceRuntimeExpectation {
  status: 'pass' | 'fail' | 'not_applicable' | 'unknown';
  desiredReplicas: number;
  readyReplicas: number;
  message: string;
}

export function resolveServiceRuntimeExpectation(input: {
  workloadObserved: boolean;
  desiredReplicas: number;
  readyReplicas: number;
}): ServiceRuntimeExpectation {
  if (!input.workloadObserved) {
    return { ...input, status: 'unknown', message: '工作负载尚未创建' };
  }
  if (input.desiredReplicas === 0) {
    return { ...input, status: 'not_applicable', message: '服务按平台期望处于休眠状态' };
  }
  if (input.readyReplicas >= input.desiredReplicas) {
    return { ...input, status: 'pass', message: '服务达到期望副本数' };
  }
  return { ...input, status: 'fail', message: '服务未达到期望副本数' };
}
