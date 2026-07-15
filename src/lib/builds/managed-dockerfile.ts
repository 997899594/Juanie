export type ManagedPackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

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
    ? 'oven/bun:1.3.9@sha256:856da45d07aeb62eb38ea3e7f9e1794c0143a4ff63efb00e6c4491b627e2a521'
    : 'node:24-bookworm-slim@sha256:cb4e8f7c443347358b7875e717c29e27bf9befc8f5a26cf18af3c3dec80e58c5';
}

function renderSecretCommand(command: string, secretNames: string[]): string {
  if (secretNames.length === 0) return `RUN ${command}`;

  const continuation = ' \\\n    ';
  const mounts = secretNames
    .map((name) => `--mount=type=secret,id=${name},required=true`)
    .join(continuation);
  const environment = secretNames
    .map((name) => `${name}="$(cat /run/secrets/${name})"`)
    .join(continuation);
  return [`RUN ${mounts}`, environment, command].join(continuation);
}

function normalizeAppDir(appDir: string): string {
  const normalized = appDir.replace(/^\.\//u, '').replace(/\/$/u, '');
  return normalized && normalized !== '.' ? normalized : '.';
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
}): string {
  const appDir = normalizeAppDir(input.appDir);
  const lines = [
    '# syntax=docker/dockerfile:1.7',
    `FROM ${buildBaseImage(input.packageManager)} AS build`,
    'WORKDIR /workspace',
    'COPY . .',
    renderSecretCommand(installCommand(input.packageManager), input.secretNames),
    renderSecretCommand(input.buildCommand, input.secretNames),
    '',
  ];

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
}): string {
  return `${[
    '# syntax=docker/dockerfile:1.7',
    `FROM ${buildBaseImage(input.packageManager)} AS build`,
    'WORKDIR /workspace',
    'COPY . .',
    renderSecretCommand(installCommand(input.packageManager), input.secretNames),
    renderSecretCommand(input.buildCommand, input.secretNames),
    '',
    `FROM ${buildBaseImage(input.packageManager)} AS artifact`,
    `COPY --from=build /workspace/${input.outputPath} /juanie/output`,
  ].join('\n')}\n`;
}
