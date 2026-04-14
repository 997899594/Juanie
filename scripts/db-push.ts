import { spawn } from 'node:child_process';

const child = spawn('bun', ['scripts/db-atlas.ts', 'apply'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
