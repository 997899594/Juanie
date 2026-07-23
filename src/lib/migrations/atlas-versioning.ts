export function extractAtlasMigrationVersion(fileName: string): string | null {
  const normalized = fileName.trim();
  const match = normalized.match(/^(\d+)(?:_|\.sql$)/u);
  return match?.[1] ?? null;
}

export function getAtlasDeclaredVersions(files: Array<{ name: string }>): string[] {
  return files
    .map((file) => extractAtlasMigrationVersion(file.name))
    .filter((version): version is string => Boolean(version))
    .sort((left, right) => {
      const leftVersion = BigInt(left);
      const rightVersion = BigInt(right);
      if (leftVersion < rightVersion) return -1;
      if (leftVersion > rightVersion) return 1;
      return 0;
    });
}

export function isAtlasTargetVersionApplied(
  appliedVersions: readonly string[],
  targetVersion: string | null | undefined
): boolean {
  return Boolean(targetVersion && appliedVersions.includes(targetVersion));
}

export function selectAtlasMigrationsThroughTarget<T extends { name: string }>(
  files: T[],
  targetVersion: string | null | undefined
): T[] {
  if (!targetVersion) {
    return files;
  }

  return files.filter((file) => {
    const version = extractAtlasMigrationVersion(file.name);
    return version !== null && BigInt(version) <= BigInt(targetVersion);
  });
}
