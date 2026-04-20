import { describe, expect, it } from 'bun:test';
import { buildEnvironmentNamespace } from '@/lib/environments/model';
import { buildPreviewNamespace } from '@/lib/environments/preview';
import { buildStableDeploymentName } from '@/lib/releases/traffic';

describe('kubernetes naming contract', () => {
  it('sanitizes project slug when building persistent namespaces', () => {
    expect(
      buildEnvironmentNamespace('nexusnote-m_pzd5', {
        name: 'staging',
        kind: 'persistent',
      })
    ).toBe('juanie-nexusnote-m-pzd5-staging');
  });

  it('sanitizes project slug when building production namespaces', () => {
    expect(
      buildEnvironmentNamespace('nexusnote-m_pzd5', {
        name: 'production',
        kind: 'production',
      })
    ).toBe('juanie-nexusnote-m-pzd5-prod');
  });

  it('sanitizes project slug when building preview namespaces', () => {
    expect(buildPreviewNamespace('nexusnote-m_pzd5', 'preview-pr-42')).toBe(
      'nexusnote-m-pzd5-preview-pr-42'
    );
  });

  it('sanitizes project slug when building workload names', () => {
    expect(buildStableDeploymentName('nexusnote-m_pzd5', 'web')).toBe('nexusnote-m-pzd5-web');
  });
});
