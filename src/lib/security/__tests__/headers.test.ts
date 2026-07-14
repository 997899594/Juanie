import { describe, expect, it } from 'bun:test';
import { buildSecurityHeaders } from '@/lib/security/headers';

describe('security headers', () => {
  it('binds scripts to a per-request nonce and denies framing', () => {
    const security = buildSecurityHeaders('nonce-1');
    expect(security.headers['Content-Security-Policy']).toContain("'nonce-nonce-1'");
    expect(security.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(security.headers['X-Frame-Options']).toBe('DENY');
  });
});
