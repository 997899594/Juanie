import { describe, expect, it } from 'bun:test';
import {
  renderManagedBuildTargetDockerfile,
  renderManagedServiceDockerfile,
} from '@/lib/builds/managed-dockerfile';

describe('managed Dockerfiles', () => {
  it('renders an ephemeral service image without repository-owned support files', () => {
    const dockerfile = renderManagedServiceDockerfile({
      packageManager: 'bun',
      appDir: 'apps/web',
      buildCommand: 'bun run build',
      startCommand: 'bun run start',
      port: 3000,
      runtimeLanguage: 'bun',
      secretNames: [],
    });

    expect(dockerfile).toContain('FROM oven/bun:1.3.9@sha256:856da45d');
    expect(dockerfile).toContain('WORKDIR /workspace/apps/web');
    expect(dockerfile).toContain('CMD ["sh", "-c", "bun run start"]');
    expect(dockerfile).not.toContain('.juanie/');
  });

  it('mounts build secrets for both dependency installation and the build command', () => {
    const dockerfile = renderManagedBuildTargetDockerfile({
      packageManager: 'pnpm',
      buildCommand: 'pnpm turbo build --filter=@acme/sdk',
      outputPath: 'packages/sdk/dist',
      secretNames: ['NPM_TOKEN'],
    });

    expect(dockerfile.match(/--mount=type=secret,id=NPM_TOKEN,required=true/g)?.length).toBe(2);
    expect(dockerfile).toContain('COPY --from=build /workspace/packages/sdk/dist /juanie/output');
  });

  it('embeds a pinned static runtime and resolves monorepo output relative to appDir', () => {
    const dockerfile = renderManagedServiceDockerfile({
      packageManager: 'npm',
      appDir: 'apps/web',
      buildCommand: 'npm run build',
      startCommand: 'npm run preview',
      port: 8080,
      runtimeLanguage: 'static',
      secretNames: [],
    });

    expect(dockerfile).toContain("COPY <<'JUANIE_STATIC_SERVER'");
    expect(dockerfile).toContain('COPY --from=build /workspace/apps/web/dist /srv');
    expect(dockerfile).toContain('CMD ["bun", "run", "/server.ts"]');
    expect(dockerfile).not.toContain('static-nginx.conf');
  });
});
