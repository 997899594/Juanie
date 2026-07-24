import { describe, expect, it } from 'bun:test';
import { POST } from '@/app/api/delivery-executions/fail/route';

describe('delivery execution failure API contract', () => {
  it('rejects a successful CI-owned outcome before authentication', async () => {
    const response = await POST(
      new Request('http://localhost/api/delivery-executions/fail', {
        method: 'POST',
        body: JSON.stringify({
          repository: 'acme/app',
          provider: 'github',
          ref: 'refs/heads/main',
          sha: 'a'.repeat(40),
          externalRunId: 'delivery-1',
          planResult: 'success',
          buildResult: 'skipped',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid CI failure outcome' });
  });
});
