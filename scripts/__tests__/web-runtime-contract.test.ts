import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

describe('production web runtime contract', () => {
  it('runs and smoke-tests the Next standalone server with Node', async () => {
    const [dockerfile, workflow] = await Promise.all([
      readFile('Dockerfile', 'utf8'),
      readFile('.github/workflows/ci.yml', 'utf8'),
    ]);

    expect(dockerfile).toContain('FROM node-toolchain AS web');
    expect(dockerfile).toContain('CMD ["/usr/local/bin/node", "server.js"]');
    expect(dockerfile).toContain('rm -rf /usr/local/lib/node_modules');
    expect(dockerfile).toContain('/usr/local/bin/npm');
    expect(workflow).toContain('/usr/local/bin/node -e "\\');
    expect(workflow).toContain("'unexpected web runtime toolchain: ' + path");
    expect(workflow).not.toContain('/usr/local/bin/bun -e "\\');
  });
});
