import { describe, expect, it } from 'bun:test';
import { assessDeliveryArtifacts } from '@/lib/builds/delivery-completion';
import type { BuildPlan } from '@/lib/builds/plan';

const digest = `sha256:${'a'.repeat(64)}`;
const plan = {
  deliverables: [
    {
      name: 'desktop',
      type: 'archive',
      appDir: '.',
      sourceTarget: 'desktop-bundle',
      variant: {
        name: 'linux-x64',
        platform: 'linux/amd64',
        extract: { from: '/out', to: '.' },
        package: { format: 'tgz' },
      },
    },
  ],
} satisfies Pick<BuildPlan, 'deliverables'>;

describe('delivery artifact completion', () => {
  it('requires every planned variant with immutable integrity metadata', () => {
    expect(assessDeliveryArtifacts(plan, [])).toEqual({
      expected: 1,
      missing: ['archive:desktop:linux-x64:linux/amd64:tgz'],
      invalid: [],
    });

    expect(
      assessDeliveryArtifacts(plan, [
        {
          kind: 'archive',
          name: 'desktop',
          variant: 'linux-x64',
          platform: 'linux/amd64',
          format: 'tgz',
          uri: 'https://github.example/artifact/1',
          checksum: digest,
          sourceImageDigest: digest,
          status: 'succeeded',
        },
      ])
    ).toEqual({ expected: 1, missing: [], invalid: [] });
  });

  it('rejects a registered artifact without checksum lineage', () => {
    const result = assessDeliveryArtifacts(plan, [
      {
        kind: 'archive',
        name: 'desktop',
        variant: 'linux-x64',
        platform: 'linux/amd64',
        format: 'tgz',
        uri: 'https://github.example/artifact/1',
        checksum: null,
        sourceImageDigest: digest,
        status: 'succeeded',
      },
    ]);

    expect(result.invalid).toEqual(['archive:desktop:linux-x64:linux/amd64:tgz']);
  });
});
