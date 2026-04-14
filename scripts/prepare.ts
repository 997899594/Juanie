import { spawnSync } from 'node:child_process';

function hasCommand(command: string, args: string[] = ['--version']): boolean {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

const shouldSkip = process.env.CI === 'true' || process.env.LEFTHOOK === '0' || !hasCommand('git');

if (shouldSkip) {
  console.log('[prepare] skipping lefthook install');
  process.exit(0);
}

const result = spawnSync('bunx', ['lefthook', 'install'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
