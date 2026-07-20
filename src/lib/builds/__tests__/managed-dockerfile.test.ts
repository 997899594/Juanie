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
      workspace: { packageName: '@acme/web' },
    });

    expect(dockerfile).toContain('FROM oven/bun:1.3.14@sha256:e10577f0db68');
    expect(dockerfile).toContain('turbo@2.10.5 prune');
    expect(dockerfile).toContain("'@acme/web'");
    expect(dockerfile).toContain('COPY --from=prune /workspace/out/json/ .');
    expect(dockerfile).toContain('COPY --from=prune /workspace/out/full/ .');
    expect(dockerfile).toContain('COPY --from=juanie_turbo_cache / /workspace/.turbo/');
    expect(dockerfile).toContain('TURBO_CACHE_DIR=/workspace/.turbo');
    expect(dockerfile).toContain('FROM scratch AS juanie-turbo-cache');
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
      workspace: { packageName: '@acme/sdk' },
    });

    expect(dockerfile.match(/--mount=type=secret,id=NPM_TOKEN,required=true/g)?.length).toBe(2);
    expect(dockerfile).toContain(`--mount=type=secret,id=NPM_TOKEN,required=true \\
    NPM_TOKEN="$(cat /run/secrets/NPM_TOKEN)" \\
    corepack enable && pnpm install --frozen-lockfile`);
    expect(dockerfile).toContain('COPY --from=build /workspace/packages/sdk/dist /juanie/output');
  });

  it('uses pnpm deploy only when explicitly selected', () => {
    const dockerfile = renderManagedServiceDockerfile({
      packageManager: 'pnpm',
      appDir: 'apps/api',
      buildCommand: 'pnpm --filter @acme/api build',
      startCommand: 'node dist/server.js',
      port: 3000,
      runtimeLanguage: 'node',
      secretNames: [],
      workspace: { packageName: '@acme/api', packageStrategy: 'pnpm-deploy' },
    });

    expect(dockerfile).toContain("pnpm --filter '@acme/api' --prod deploy /runtime");
    expect(dockerfile).toContain('COPY --from=package /runtime /app');
    expect(dockerfile).toContain('WORKDIR /app');
    expect(dockerfile).not.toContain('COPY --from=build /workspace /workspace');
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
