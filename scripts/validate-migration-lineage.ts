import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const migrationDirectories = ['migrations', 'migrations-contract'] as const;
const reconciliationDirective = /^-- juanie:history-reconciliation-through (\d+)$/mu;

function runGit(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function migrationVersion(filePath: string): bigint {
  const fileName = filePath.split('/').at(-1) ?? '';
  const match = fileName.match(/^(\d+)_.*\.sql$/u);
  if (!match?.[1]) {
    throw new Error(`Migration file has no numeric version prefix: ${filePath}`);
  }
  return BigInt(match[1]);
}

function validateAddedMigration(input: {
  filePath: string;
  directory: (typeof migrationDirectories)[number];
  previousFrontier: bigint;
}): void {
  const version = migrationVersion(input.filePath);
  if (version > input.previousFrontier) {
    return;
  }

  const source = readFileSync(input.filePath, 'utf8');
  const reconciliationThrough = source.match(reconciliationDirective)?.[1];
  if (input.directory !== 'migrations' || !reconciliationThrough) {
    throw new Error(
      `${input.filePath} inserts version ${version} behind published frontier ${input.previousFrontier}`
    );
  }

  const reconciledFrontier = BigInt(reconciliationThrough);
  if (reconciledFrontier >= version) {
    throw new Error(`${input.filePath} must sort after reconciled frontier ${reconciledFrontier}`);
  }
}

function main(): void {
  const baseRevision = process.argv[2];
  if (!baseRevision || /^0+$/u.test(baseRevision)) {
    console.log('Migration lineage validation skipped: no base revision');
    return;
  }

  runGit(['cat-file', '-e', `${baseRevision}^{commit}`]);
  const changes = runGit([
    'diff',
    '--name-status',
    '--diff-filter=ACDMRT',
    baseRevision,
    '--',
    ...migrationDirectories,
  ])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));

  const rewrittenFiles = changes.filter(
    ([status, filePath]) => status !== 'A' && filePath?.endsWith('.sql')
  );
  if (rewrittenFiles.length > 0) {
    throw new Error(
      `Published migration history is immutable:\n${rewrittenFiles
        .map((change) => change.join('\t'))
        .join('\n')}`
    );
  }

  for (const directory of migrationDirectories) {
    const previousFiles = runGit(['ls-tree', '-r', '--name-only', baseRevision, '--', directory])
      .split('\n')
      .filter((filePath) => filePath.endsWith('.sql'));
    const previousFrontier = previousFiles.reduce((frontier, filePath) => {
      const version = migrationVersion(filePath);
      return version > frontier ? version : frontier;
    }, 0n);
    const addedFiles = changes
      .filter(([status, filePath]) => status === 'A' && filePath?.startsWith(`${directory}/`))
      .map(([, filePath]) => filePath)
      .filter((filePath): filePath is string => Boolean(filePath));

    for (const filePath of addedFiles) {
      validateAddedMigration({ filePath, directory, previousFrontier });
    }
  }

  console.log(`Migration lineage is append-only relative to ${baseRevision}`);
}

main();
