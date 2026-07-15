import { describe, expect, it } from 'bun:test';
import { POST } from '@/app/api/build-runs/route';

describe('build run API contract', () => {
  it('rejects legacy client-selected services and targets', async () => {
    const response = await POST(
      new Request('http://localhost/api/build-runs', {
        method: 'POST',
        body: JSON.stringify({
          repository: 'acme/app',
          ref: 'refs/heads/main',
          sha: 'a'.repeat(40),
          services: ['web'],
          targets: ['sdk'],
        }),
      })
    );
    const payload = (await response.json()) as { error: string; details: string[] };

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid build run request');
    expect(payload.details.some((detail) => detail.includes('Unrecognized keys'))).toBe(true);
  });

  it('rejects mutable or malformed source revisions before authentication', async () => {
    const response = await POST(
      new Request('http://localhost/api/build-runs', {
        method: 'POST',
        body: JSON.stringify({
          repository: 'acme/app',
          ref: 'refs/heads/main',
          sha: 'main',
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});
