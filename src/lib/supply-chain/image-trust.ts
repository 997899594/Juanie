const imageDigestPattern = /^sha256:[a-f0-9]{64}$/u;

export function assertImageDigest(value: string | null | undefined): string {
  const digest = value?.trim().toLowerCase();
  if (!digest || !imageDigestPattern.test(digest)) {
    throw new Error('Deployable image must include a valid sha256 registry digest');
  }
  return digest;
}

export function resolveImmutableImageReference(input: {
  image: string;
  digest: string | null | undefined;
}): string {
  const image = input.image.trim();
  if (!image) throw new Error('Deployable image repository is required');
  const digest = assertImageDigest(input.digest);
  const atIndex = image.lastIndexOf('@');
  if (atIndex >= 0) {
    const embeddedDigest = assertImageDigest(image.slice(atIndex + 1));
    if (embeddedDigest !== digest) {
      throw new Error('Image reference digest does not match the reported registry digest');
    }
    return `${image.slice(0, atIndex)}@${digest}`;
  }
  return `${image}@${digest}`;
}

export function isImmutableImageReference(value: string): boolean {
  const atIndex = value.lastIndexOf('@');
  return atIndex > 0 && imageDigestPattern.test(value.slice(atIndex + 1));
}
