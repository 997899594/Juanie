export interface SecurityHeaders {
  nonce: string;
  headers: Record<string, string>;
}

export function buildSecurityHeaders(nonce = crypto.randomUUID()): SecurityHeaders {
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com https://gitlab.com",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  return {
    nonce,
    headers: {
      'Content-Security-Policy': contentSecurityPolicy,
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...(process.env.NODE_ENV === 'production'
        ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }
        : {}),
    },
  };
}
