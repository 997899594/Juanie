import { describe, expect, it } from 'bun:test';
import {
  buildDomainRouteName,
  buildEnvironmentAccessUrl,
  buildPreviewEnvironmentHostname,
  buildPrimaryEnvironmentHostname,
  pickDefaultPublicService,
  pickPrimaryEnvironmentDomain,
} from '@/lib/domains/defaults';

describe('domain defaults', () => {
  it('builds the primary environment hostname', () => {
    expect(buildPrimaryEnvironmentHostname('nexusnote')).toBe('nexusnote.juanie.art');
  });

  it('builds a deterministic preview hostname', () => {
    expect(
      buildPreviewEnvironmentHostname('nexusnote', { name: 'preview-feature-release-intel' })
    ).toBe('nexusnote-preview-feature-release-intel.juanie.art');
  });

  it('builds access URLs and route names', () => {
    expect(buildEnvironmentAccessUrl('nexusnote.juanie.art')).toBe('https://nexusnote.juanie.art');
    expect(buildDomainRouteName('nexusnote-preview-feature.juanie.art').startsWith('route-')).toBe(
      true
    );
  });

  it('picks the primary public web service', () => {
    const service = pickDefaultPublicService([
      { id: 'worker', name: 'worker', type: 'worker', isPublic: false },
      { id: 'api', name: 'api', type: 'web', isPublic: true },
      { id: 'web', name: 'web', type: 'web', isPublic: true },
    ]);

    expect(service?.id).toBe('web');
  });

  it('prefers verified custom domains for access links', () => {
    const domain = pickPrimaryEnvironmentDomain([
      { id: 'default', hostname: 'nexusnote.juanie.art', isCustom: false, isVerified: true },
      { id: 'custom', hostname: 'preview.nexusnote.dev', isCustom: true, isVerified: true },
    ]);

    expect(domain?.hostname).toBe('preview.nexusnote.dev');
  });
});
