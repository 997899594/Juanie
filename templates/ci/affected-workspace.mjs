#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function decodeJsonEnv(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
}

function readInputs() {
  return {
    services: decodeJsonEnv('JUANIE_SERVICE_MATRIX_B64', []),
    deliverables: decodeJsonEnv('JUANIE_DELIVERABLE_MATRIX_B64', []),
    affectedRules: decodeJsonEnv('JUANIE_AFFECTED_RULES_B64', {}),
    beforeSha:
      process.env.JUANIE_BEFORE_SHA ||
      process.env.GITHUB_EVENT_BEFORE ||
      process.env.CI_COMMIT_BEFORE_SHA ||
      '',
    sourceSha: process.env.JUANIE_SOURCE_SHA || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA,
    forceFullBuild:
      process.env.JUANIE_FORCE_FULL_BUILD === 'true' ||
      process.env.JUANIE_FORCE_FULL_BUILD === '1',
  };
}

function readRootPackageManager() {
  if (!existsSync('package.json')) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const declared = packageJson.packageManager;
    if (typeof declared === 'string') {
      if (declared.startsWith('bun@')) return 'bun';
      if (declared.startsWith('pnpm@')) return 'pnpm';
      if (declared.startsWith('yarn@')) return 'yarn';
      if (declared.startsWith('npm@')) return 'npm';
    }

    const devEngineName = packageJson.devEngines?.packageManager?.name;
    if (['bun', 'pnpm', 'yarn', 'npm'].includes(devEngineName)) {
      return devEngineName;
    }
  } catch {
    return null;
  }

  return null;
}

function commandExists(command) {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function getTurboCommand(affectedRules) {
  const packageManager = affectedRules.packageManager || readRootPackageManager() || 'npm';

  if (packageManager === 'pnpm') {
    return { command: 'corepack', prefixArgs: ['pnpm', 'dlx', 'turbo@latest'] };
  }

  if (packageManager === 'yarn') {
    return { command: 'corepack', prefixArgs: ['yarn', 'dlx', 'turbo@latest'] };
  }

  if (packageManager === 'bun' && commandExists('bunx')) {
    return { command: 'bunx', prefixArgs: ['--bun', 'turbo@latest'] };
  }

  return { command: 'npx', prefixArgs: ['--yes', 'turbo@latest'] };
}

function isZeroSha(value) {
  return !value || /^0+$/.test(value);
}

function getChangedFiles({ beforeSha, sourceSha }) {
  if (isZeroSha(beforeSha) || !sourceSha) {
    return [];
  }

  const output = execFileSync('git', ['diff', '--name-only', beforeSha, sourceSha], {
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchesInput(file, pattern) {
  if (!pattern) return false;
  if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return file.startsWith(prefix) && !file.slice(prefix.length).includes('/');
  }
  if (pattern.endsWith('/')) return file.startsWith(pattern);
  return file === pattern;
}

function matchesAnyInput(file, patterns) {
  return patterns.some((pattern) => matchesInput(file, pattern));
}

function isInsideAppDir(file, appDir) {
  return file === appDir || file.startsWith(`${appDir}/`);
}

function shouldBuildAllByPath({ changedFiles, services, deliverables, affectedRules }) {
  const serviceDirs = services.map((service) => service.appDir);
  const deliverableDirs = deliverables.map((deliverable) => deliverable.appDir);
  const globalInputs = affectedRules.global ?? [];
  const sharedInputs = affectedRules.inputs ?? [];
  const globalPrefixes = ['.github/', '.gitlab/'];
  const isServiceOrDeliverableFile = (file) =>
    [...serviceDirs, ...deliverableDirs].some((appDir) => isInsideAppDir(file, appDir));
  const isSharedInputFile = (file) =>
    matchesAnyInput(file, sharedInputs) && !isServiceOrDeliverableFile(file);

  return changedFiles.some(
    (file) =>
      matchesAnyInput(file, globalInputs) ||
      globalPrefixes.some((prefix) => file.startsWith(prefix)) ||
      isSharedInputFile(file)
  );
}

function selectByPath({ services, deliverables, changedFiles, shouldBuildAll }) {
  const changedDeliverables = shouldBuildAll
    ? deliverables
    : deliverables.filter((deliverable) =>
        changedFiles.some((file) => isInsideAppDir(file, deliverable.appDir))
      );
  const sourceServicesForDeliverables = new Set(
    changedDeliverables.map((deliverable) => deliverable.sourceService).filter(Boolean)
  );
  const selectedServices = shouldBuildAll
    ? services
    : services.filter(
        (service) =>
          sourceServicesForDeliverables.has(service.name) ||
          changedFiles.some((file) => isInsideAppDir(file, service.appDir))
      );
  const selectedServiceNames = new Set(selectedServices.map((service) => service.name));
  const selectedDeliverables = shouldBuildAll
    ? deliverables
    : deliverables.filter(
        (deliverable) =>
          changedDeliverables.includes(deliverable) ||
          (deliverable.sourceService && selectedServiceNames.has(deliverable.sourceService))
      );

  return { services: selectedServices, deliverables: selectedDeliverables };
}

function runTurboQueryAffected({ beforeSha, sourceSha, affectedRules }) {
  if (affectedRules.strategy !== 'turbo' || isZeroSha(beforeSha) || !sourceSha) {
    return null;
  }

  const turbo = getTurboCommand(affectedRules);
  const args = [
    'query',
    'affected',
    '--base',
    beforeSha,
    '--head',
    sourceSha,
    '--no-color',
  ];

  if (affectedRules.useTaskInputs) {
    args.push('--tasks', affectedRules.task || 'build');
  } else {
    args.push('--packages');
  }

  try {
    const output = execFileSync(turbo.command, [...turbo.prefixArgs, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
      },
    });
    const jsonStart = output.indexOf('{');
    if (jsonStart < 0) {
      return null;
    }

    return JSON.parse(output.slice(jsonStart));
  } catch (error) {
    console.warn(
      `Juanie Turborepo affected query failed; falling back to path rules: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function getAffectedPackageNames(queryResult) {
  if (!queryResult) {
    return null;
  }

  const packages = queryResult.data?.affectedPackages?.items;
  if (Array.isArray(packages)) {
    return packages.map((item) => item?.name).filter(Boolean);
  }

  const tasks = queryResult.data?.affectedTasks?.items;
  if (Array.isArray(tasks)) {
    return tasks.map((item) => item?.package?.name).filter(Boolean);
  }

  return null;
}

function selectByTurboGraph({ services, deliverables, packageNames, changedFiles }) {
  if (!packageNames) {
    return null;
  }

  const affectedPackages = new Set(packageNames);
  const changedDeliverables = deliverables.filter((deliverable) =>
    changedFiles.some((file) => isInsideAppDir(file, deliverable.appDir))
  );
  const sourceServicesForDeliverables = new Set(
    changedDeliverables.map((deliverable) => deliverable.sourceService).filter(Boolean)
  );
  const selectedServices = services.filter(
    (service) =>
      affectedPackages.has(service.packageName || service.name) ||
      sourceServicesForDeliverables.has(service.name)
  );
  const selectedServiceNames = new Set(selectedServices.map((service) => service.name));
  const selectedDeliverables = deliverables.filter(
    (deliverable) =>
      changedDeliverables.includes(deliverable) ||
      (deliverable.sourceService && selectedServiceNames.has(deliverable.sourceService))
  );

  return { services: selectedServices, deliverables: selectedDeliverables };
}

function writeGitHubOutputs(result) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) {
    return;
  }

  writeFileSync(githubOutput, `services=${JSON.stringify(result.services)}\n`, { flag: 'a' });
  writeFileSync(githubOutput, `deliverables=${JSON.stringify(result.deliverables)}\n`, {
    flag: 'a',
  });
  writeFileSync(
    githubOutput,
    `service_names=${JSON.stringify(result.services.map((service) => service.name))}\n`,
    { flag: 'a' }
  );
}

function writeGitLabArtifacts(result) {
  writeFileSync('services.json', JSON.stringify(result.services));
  writeFileSync(
    'service-names.json',
    JSON.stringify(result.services.map((service) => service.name))
  );
  writeFileSync('deliverables.json', JSON.stringify(result.deliverables));
}

function main() {
  const input = readInputs();
  const fullBuild = input.forceFullBuild || isZeroSha(input.beforeSha);
  const changedFiles = fullBuild ? [] : getChangedFiles(input);
  const shouldBuildAll =
    fullBuild ||
    input.affectedRules.strategy === 'all' ||
    shouldBuildAllByPath({
      changedFiles,
      services: input.services,
      deliverables: input.deliverables,
      affectedRules: input.affectedRules,
    });

  let result = null;
  if (shouldBuildAll) {
    result = { services: input.services, deliverables: input.deliverables };
  } else {
    const queryResult = runTurboQueryAffected(input);
    result = selectByTurboGraph({
      services: input.services,
      deliverables: input.deliverables,
      packageNames: getAffectedPackageNames(queryResult),
      changedFiles,
    });
  }

  if (!result) {
    result = selectByPath({
      services: input.services,
      deliverables: input.deliverables,
      changedFiles,
      shouldBuildAll,
    });
  }

  writeGitHubOutputs(result);
  if (existsSync('.gitlab-ci.yml') || process.env.GITLAB_CI) {
    writeGitLabArtifacts(result);
  }
}

main();
