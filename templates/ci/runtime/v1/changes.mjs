#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function isZeroSha(value) {
  return !value || /^0+$/.test(value);
}

function readPackageManager() {
  if (!existsSync('package.json')) return 'npm';

  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const declared = packageJson.packageManager || packageJson.devEngines?.packageManager?.name || '';
    for (const packageManager of ['bun', 'pnpm', 'yarn', 'npm']) {
      if (declared === packageManager || declared.startsWith(`${packageManager}@`)) {
        return packageManager;
      }
    }
  } catch {
    return 'npm';
  }

  return 'npm';
}

function getTurboCommand() {
  switch (readPackageManager()) {
    case 'bun':
      return { command: 'bunx', args: ['--bun', 'turbo@latest'] };
    case 'pnpm':
      return { command: 'corepack', args: ['pnpm', 'dlx', 'turbo@latest'] };
    case 'yarn':
      return { command: 'corepack', args: ['yarn', 'dlx', 'turbo@latest'] };
    default:
      return { command: 'npx', args: ['--yes', 'turbo@latest'] };
  }
}

function getChangedFiles(beforeSha, sourceSha) {
  if (isZeroSha(beforeSha) || !sourceSha) return [];
  return execFileSync('git', ['diff', '--name-only', beforeSha, sourceSha], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAffectedPackages(beforeSha, sourceSha) {
  if (isZeroSha(beforeSha) || !sourceSha || !existsSync('turbo.json')) return null;
  const turbo = getTurboCommand();

  try {
    const output = execFileSync(
      turbo.command,
      [...turbo.args, 'query', 'affected', '--base', beforeSha, '--head', sourceSha, '--packages', '--no-color'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
      }
    );
    const jsonStart = output.indexOf('{');
    if (jsonStart < 0) return null;
    const payload = JSON.parse(output.slice(jsonStart));
    const packages = payload.data?.affectedPackages?.items;
    return Array.isArray(packages) ? packages.map((item) => item?.name).filter(Boolean) : null;
  } catch (error) {
    console.warn(
      `Juanie could not query the Turborepo graph; the control plane will use declared path rules: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function appendGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

function main() {
  const beforeSha =
    process.env.JUANIE_BEFORE_SHA ||
    process.env.GITHUB_EVENT_BEFORE ||
    process.env.CI_COMMIT_BEFORE_SHA ||
    '';
  const sourceSha = process.env.JUANIE_SOURCE_SHA || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '';
  const forceFullBuild =
    isZeroSha(beforeSha) ||
    process.env.JUANIE_FORCE_FULL_BUILD === 'true' ||
    process.env.JUANIE_FORCE_FULL_BUILD === '1';
  const changedFiles = forceFullBuild ? [] : getChangedFiles(beforeSha, sourceSha);
  const affectedPackages = forceFullBuild ? null : getAffectedPackages(beforeSha, sourceSha);

  appendGitHubOutput('changed_files', JSON.stringify(changedFiles));
  appendGitHubOutput(
    'affected_packages',
    affectedPackages === null ? '' : JSON.stringify(affectedPackages)
  );
  appendGitHubOutput('force_full_build', String(forceFullBuild));

  const outputDir = process.env.JUANIE_CHANGE_OUTPUT_DIR;
  if (outputDir) {
    writeFileSync(`${outputDir}/changed-files.json`, JSON.stringify(changedFiles));
    if (affectedPackages !== null) {
      writeFileSync(`${outputDir}/affected-packages.json`, JSON.stringify(affectedPackages));
    }
    writeFileSync(`${outputDir}/force-full-build`, String(forceFullBuild));
  }
}

main();
