import { describe, expect, it } from 'bun:test';
import {
  buildServiceVerificationScript,
  buildVerificationPodName,
  normalizeServiceVerificationPath,
  SERVICE_VERIFY_IMAGE,
} from '@/lib/k8s/service-verification';

describe('kubernetes service verification', () => {
  it('规范化探活路径', () => {
    expect(normalizeServiceVerificationPath('api/health')).toBe('/api/health');
    expect(normalizeServiceVerificationPath('/ready')).toBe('/ready');
  });

  it('生成探活 Pod 名称时替换非法字符', () => {
    const podName = buildVerificationPodName('web_service');

    expect(podName.startsWith('web-service-verify-')).toBe(true);
    expect(podName.length <= 63).toBe(true);
  });

  it('生成 curl 探活脚本并保留重试参数', () => {
    const script = buildServiceVerificationScript({
      serviceName: 'web',
      port: 3000,
      paths: ['api/health'],
      attemptCount: 3,
      sleepSeconds: 2,
      requestTimeoutSeconds: 5,
    });

    expect(script).toContain('set -eu');
    expect(script).toContain('while [ "$attempt" -le 3 ]; do');
    expect(script).toContain("'http://web:3000/api/health'");
    expect(script).toContain('sleep 2');
    expect(script).toContain('echo verification_ok');
  });

  it('集中声明服务探活镜像', () => {
    expect(SERVICE_VERIFY_IMAGE).toBe('curlimages/curl:8.7.1');
  });
});
