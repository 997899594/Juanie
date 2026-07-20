export type ManagedPackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';
export type ManagedPackageStrategy = 'turbo-prune' | 'pnpm-deploy';

export interface ManagedWorkspacePackage {
  packageName: string;
  packageStrategy?: ManagedPackageStrategy;
}

const turboVersion = '2.10.5';

function installCommand(packageManager: ManagedPackageManager): string {
  switch (packageManager) {
    case 'bun':
      return 'bun install --frozen-lockfile';
    case 'pnpm':
      return 'corepack enable && pnpm install --frozen-lockfile';
    case 'yarn':
      return 'corepack enable && yarn install --immutable';
    case 'npm':
      return 'npm ci';
  }
}

function buildBaseImage(packageManager: ManagedPackageManager): string {
  return packageManager === 'bun'
    ? 'oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4'
    : 'node:24-bookworm-slim@sha256:cb4e8f7c443347358b7875e717c29e27bf9befc8f5a26cf18af3c3dec80e58c5';
}

function renderRunCommand(command: string, secretNames: string[]): string {
  const continuation = ` \\
    `;
  const mounts = [...secretNames.map((name) => `--mount=type=secret,id=${name},required=true`)];
  if (mounts.length === 0) return `RUN ${command}`;

  const environment = secretNames
    .map((name) => `${name}="$(cat /run/secrets/${name})"`)
    .join(continuation);
  return [`RUN ${mounts.join(continuation)}`, ...(environment ? [environment] : []), command].join(
    continuation
  );
}

function normalizeAppDir(appDir: string): string {
  const normalized = appDir.replace(/^\.\//u, '').replace(/\/$/u, '');
  return normalized && normalized !== '.' ? normalized : '.';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/gu, `'"'"'`)}'`;
}

function turboCommand(packageManager: ManagedPackageManager): string {
  switch (packageManager) {
    case 'bun':
      return `bunx turbo@${turboVersion}`;
    case 'pnpm':
      return `corepack enable && pnpm dlx turbo@${turboVersion}`;
    case 'yarn':
      return `corepack enable && yarn dlx turbo@${turboVersion}`;
    case 'npm':
      return `npx --yes turbo@${turboVersion}`;
  }
}

function renderBuildStages(input: {
  packageManager: ManagedPackageManager;
  buildCommand: string;
  secretNames: string[];
  workspace?: ManagedWorkspacePackage;
}): string[] {
  const baseImage = buildBaseImage(input.packageManager);
  if (!input.workspace) {
    return [
      `FROM ${baseImage} AS build`,
      'WORKDIR /workspace',
      'COPY . .',
      renderRunCommand(installCommand(input.packageManager), input.secretNames),
      renderRunCommand(input.buildCommand, input.secretNames),
    ];
  }

  return [
    `FROM ${baseImage} AS prune`,
    'WORKDIR /workspace',
    'COPY . .',
    `RUN ${turboCommand(input.packageManager)} prune ${shellQuote(input.workspace.packageName)} --docker`,
    '',
    `FROM ${baseImage} AS build`,
    'WORKDIR /workspace',
    'COPY --from=prune /workspace/out/json/ .',
    renderRunCommand(installCommand(input.packageManager), input.secretNames),
    'COPY --from=prune /workspace/out/full/ .',
    'COPY --from=juanie_turbo_cache / /workspace/.turbo/',
    'ENV TURBO_CACHE_DIR=/workspace/.turbo',
    renderRunCommand(input.buildCommand, input.secretNames),
    '',
    'FROM scratch AS juanie-turbo-cache',
    'COPY --from=build /workspace/.turbo /',
  ];
}

const staticServer = `const root = '/srv';
Bun.serve({
  port: 8080,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response('ok');
    const decoded = decodeURIComponent(url.pathname).replace(/^\\/+/, '');
    if (decoded.split('/').includes('..')) return new Response('invalid path', { status: 400 });
    const requested = Bun.file(root + '/' + (decoded || 'index.html'));
    return (await requested.exists()) ? new Response(requested) : new Response(Bun.file(root + '/index.html'));
  },
});`;

export function renderManagedServiceDockerfile(input: {
  packageManager: ManagedPackageManager;
  appDir: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  outputPath?: string;
  runtimeLanguage?: 'node' | 'bun' | 'static' | 'custom';
  secretNames: string[];
  workspace?: ManagedWorkspacePackage;
}): string {
  const appDir = normalizeAppDir(input.appDir);
  const lines = ['# syntax=docker/dockerfile:1.7', ...renderBuildStages(input), ''];

  if (input.runtimeLanguage === 'static') {
    const outputPath = input.outputPath ?? (appDir === '.' ? 'dist' : `${appDir}/dist`);
    lines.push(
      `FROM ${buildBaseImage('bun')} AS runtime`,
      "COPY <<'JUANIE_STATIC_SERVER' /server.ts",
      staticServer,
      'JUANIE_STATIC_SERVER',
      `COPY --from=build /workspace/${outputPath} /srv`,
      'EXPOSE 8080',
      'HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\',
      '  CMD bun -e "fetch(\'http://127.0.0.1:8080/healthz\').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"',
      'CMD ["bun", "run", "/server.ts"]'
    );
  } else if (input.workspace?.packageStrategy === 'pnpm-deploy') {
    if (input.packageManager !== 'pnpm') {
      throw new Error('pnpm-deploy requires monorepo.packageManager=pnpm');
    }
    lines.push(
      'FROM build AS package',
      `RUN corepack enable && pnpm --filter ${shellQuote(input.workspace.packageName)} --prod deploy /runtime`,
      '',
      `FROM ${buildBaseImage('npm')} AS runtime`,
      'WORKDIR /app',
      'ENV NODE_ENV=production',
      'COPY --from=package /runtime /app',
      `EXPOSE ${input.port}`,
      `CMD ["sh", "-c", ${JSON.stringify(input.startCommand)}]`
    );
  } else {
    lines.push(
      `FROM ${buildBaseImage(input.packageManager)} AS runtime`,
      'WORKDIR /workspace',
      'ENV NODE_ENV=production',
      'COPY --from=build /workspace /workspace',
      `WORKDIR /workspace/${appDir}`,
      `EXPOSE ${input.port}`,
      `CMD ["sh", "-c", ${JSON.stringify(input.startCommand)}]`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function renderManagedBuildTargetDockerfile(input: {
  packageManager: ManagedPackageManager;
  buildCommand: string;
  outputPath: string;
  secretNames: string[];
  workspace?: ManagedWorkspacePackage;
}): string {
  return `${[
    '# syntax=docker/dockerfile:1.7',
    ...renderBuildStages(input),
    '',
    `FROM ${buildBaseImage(input.packageManager)} AS artifact`,
    `COPY --from=build /workspace/${input.outputPath} /juanie/output`,
  ].join('\n')}\n`;
}
