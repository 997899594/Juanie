function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getPublicOrigin(): string {
  const value = process.env.JUANIE_PUBLIC_ORIGIN?.trim();
  if (!value) {
    throw new Error('JUANIE_PUBLIC_ORIGIN is required');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('JUANIE_PUBLIC_ORIGIN must be an absolute HTTP(S) origin');
  }

  const isHttpLoopback = url.protocol === 'http:' && isLoopbackHostname(url.hostname);
  if (
    (url.protocol !== 'https:' && !isHttpLoopback) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('JUANIE_PUBLIC_ORIGIN must be an HTTPS origin without credentials or a path');
  }

  return url.origin;
}
