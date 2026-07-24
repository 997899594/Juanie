import { describe, expect, it } from 'bun:test';
import {
  assertImageDigest,
  isImmutableImageReference,
  resolveImmutableImageReference,
} from '@/lib/supply-chain/image-trust';

const digest = `sha256:${'a'.repeat(64)}`;

describe('image trust', () => {
  it('materializes an immutable reference from a tag and digest', () => {
    expect(resolveImmutableImageReference({ image: 'ghcr.io/acme/api:sha-123', digest })).toBe(
      `ghcr.io/acme/api:sha-123@${digest}`
    );
  });

  it('rejects missing, malformed, and mismatched digests', () => {
    expect(() => assertImageDigest(null)).toThrow('sha256');
    expect(() => assertImageDigest('sha256:1234')).toThrow('sha256');
    expect(() =>
      resolveImmutableImageReference({
        image: `ghcr.io/acme/api@sha256:${'b'.repeat(64)}`,
        digest,
      })
    ).toThrow('does not match');
  });

  it('recognizes only digest-pinned references', () => {
    expect(isImmutableImageReference(`ghcr.io/acme/api@${digest}`)).toBe(true);
    expect(isImmutableImageReference('ghcr.io/acme/api:latest')).toBe(false);
  });
});
