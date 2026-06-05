import { describe, expect, it } from 'bun:test';
import {
  getDeliveryReleaseArtifacts,
  getDeployableReleaseArtifacts,
  getReleaseArtifactDisplayName,
  getReleaseArtifactIdentity,
  getReleaseArtifactKindLabel,
  getReleaseArtifactUri,
  isDeployableReleaseArtifact,
} from '@/lib/releases/artifacts';
import { buildDeliveryArtifactViewItems } from '@/lib/releases/delivery-artifact-view';

describe('release artifact helpers', () => {
  it('keeps image artifacts deployable while leaving customer packages out of deployment', () => {
    const artifacts = [
      {
        kind: 'image',
        serviceId: 'svc-web',
        imageUrl: 'ghcr.io/acme/web:sha-1',
        service: {
          id: 'svc-web',
          name: 'web',
        },
      },
      {
        kind: 'package',
        name: 'kit',
        variant: 'sdk',
        platform: 'any',
        uri: 's3://artifacts/kit-sdk.tgz',
      },
    ];

    expect(isDeployableReleaseArtifact(artifacts[0])).toBe(true);
    expect(isDeployableReleaseArtifact(artifacts[1])).toBe(false);
    expect(getDeployableReleaseArtifacts(artifacts).length).toBe(1);
    expect(getDeliveryReleaseArtifacts(artifacts).length).toBe(1);
  });

  it('uses uri as the canonical artifact location and imageUrl as image fallback', () => {
    expect(getReleaseArtifactUri({ uri: 's3://artifacts/kit.tgz' })).toBe('s3://artifacts/kit.tgz');
    expect(getReleaseArtifactUri({ imageUrl: 'ghcr.io/acme/web:sha-1' })).toBe(
      'ghcr.io/acme/web:sha-1'
    );
  });

  it('builds readable names for package variants without a service', () => {
    expect(
      getReleaseArtifactDisplayName({
        kind: 'package',
        name: 'kit',
        variant: 'viewer-runtime',
        platform: 'any',
      })
    ).toBe('kit / viewer-runtime / any');
  });

  it('builds stable identities for delivery artifacts across releases', () => {
    expect(
      getReleaseArtifactIdentity({
        kind: 'package',
        name: 'kit',
        variant: 'viewer-runtime',
        platform: 'linux-amd64',
      })
    ).toBe('package:kit:viewer-runtime:linux-amd64');
  });

  it('labels artifact kinds with product-facing delivery language', () => {
    expect(getReleaseArtifactKindLabel({ kind: 'image' })).toBe('部署镜像');
    expect(getReleaseArtifactKindLabel({ kind: 'baremetal' })).toBe('裸机包');
  });

  it('builds delivery artifact views with source release fallback and dedupe', () => {
    const artifacts = buildDeliveryArtifactViewItems({
      currentReleaseId: 'rel-production',
      currentArtifacts: [
        {
          id: 'image-web',
          releaseId: 'rel-production',
          kind: 'image',
          serviceId: 'svc-web',
          service: { id: 'svc-web', name: 'web' },
          imageUrl: 'ghcr.io/demo/web:2',
        },
        {
          id: 'package-production',
          releaseId: 'rel-production',
          kind: 'package',
          name: 'nexusnote',
          variant: 'bundle',
          platform: 'linux-amd64',
          format: 'tgz',
          uri: 's3://artifacts/nexusnote-production.tgz',
          status: 'succeeded',
        },
      ],
      sourceRelease: {
        id: 'rel-staging',
        artifacts: [
          {
            id: 'package-staging',
            releaseId: 'rel-staging',
            kind: 'package',
            name: 'nexusnote',
            variant: 'bundle',
            platform: 'linux-amd64',
            format: 'tgz',
            uri: 's3://artifacts/nexusnote-staging.tgz',
            status: 'succeeded',
          },
          {
            id: 'cli-staging',
            releaseId: 'rel-staging',
            kind: 'package',
            name: 'nexusnote-cli',
            variant: 'bundle',
            platform: 'linux-amd64',
            format: 'tgz',
            uri: 's3://artifacts/nexusnote-cli.tgz',
            status: 'succeeded',
          },
        ],
      },
    });

    expect(artifacts).toEqual([
      {
        id: 'package-production',
        releaseId: 'rel-production',
        kind: 'package',
        name: 'nexusnote',
        variant: 'bundle',
        platform: 'linux-amd64',
        format: 'tgz',
        uri: 's3://artifacts/nexusnote-production.tgz',
        status: 'succeeded',
        sourceImageDigest: undefined,
      },
      {
        id: 'cli-staging',
        releaseId: 'rel-staging',
        kind: 'package',
        name: 'nexusnote-cli',
        variant: 'bundle',
        platform: 'linux-amd64',
        format: 'tgz',
        uri: 's3://artifacts/nexusnote-cli.tgz',
        status: 'succeeded',
        sourceImageDigest: undefined,
      },
    ]);
  });
});
