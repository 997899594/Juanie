export const packageManagerNames = ['bun', 'npm', 'pnpm', 'yarn'] as const;

export type PackageManagerName = (typeof packageManagerNames)[number];

export interface PinnedPackageManager {
  name: PackageManagerName;
  version: string;
  spec: string;
  major: number;
}

const packageManagerPattern =
  /^(bun|npm|pnpm|yarn)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+sha(?:224|256|384|512)\.[a-fA-F0-9]+)?$/u;

const lockfilesByPackageManager: Record<PackageManagerName, readonly string[]> = {
  bun: ['bun.lock', 'bun.lockb'],
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
};

const knownLockfiles = new Set(Object.values(lockfilesByPackageManager).flat());

export class PackageManagerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageManagerContractError';
  }
}

export function parsePinnedPackageManager(value: unknown): PinnedPackageManager {
  if (typeof value !== 'string') {
    throw new PackageManagerContractError(
      'Root package.json must declare packageManager as name@exact-version'
    );
  }

  const match = packageManagerPattern.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    throw new PackageManagerContractError(
      `Unsupported packageManager ${JSON.stringify(value)}; expected bun, npm, pnpm, or yarn with an exact semantic version`
    );
  }

  const name = match[1] as PackageManagerName;
  return {
    name,
    version: match[2],
    spec: value.trim(),
    major: Number.parseInt(match[2].split('.')[0] ?? '', 10),
  };
}

export function assertPackageManagerLockfile(
  packageManager: PinnedPackageManager,
  rootFiles: Iterable<string>
): void {
  const presentLockfiles = [...rootFiles].filter((file) => knownLockfiles.has(file)).sort();
  const expectedLockfiles = lockfilesByPackageManager[packageManager.name];
  const matchingLockfiles = presentLockfiles.filter((file) => expectedLockfiles.includes(file));

  if (matchingLockfiles.length === 0) {
    throw new PackageManagerContractError(
      `${packageManager.spec} requires one of: ${expectedLockfiles.join(', ')}`
    );
  }

  if (presentLockfiles.length !== 1) {
    throw new PackageManagerContractError(
      `Repository must contain exactly one package-manager lockfile; found: ${presentLockfiles.join(', ')}`
    );
  }
}

export function resolvePackageManagerContract(
  packageManagerValue: unknown,
  rootFiles: Iterable<string>
): PinnedPackageManager {
  const packageManager = parsePinnedPackageManager(packageManagerValue);
  assertPackageManagerLockfile(packageManager, rootFiles);
  return packageManager;
}
