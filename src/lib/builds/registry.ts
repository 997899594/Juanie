export function resolveWorkloadImageRepository(repository: string): string {
  const prefix =
    process.env.JUANIE_WORKLOAD_REGISTRY?.trim() || 'ghcr.io/997899594/juanie-workload';
  if (!/^[a-z0-9.-]+(?::[0-9]+)?\/[a-z0-9._/-]+$/u.test(prefix)) {
    throw new Error('JUANIE_WORKLOAD_REGISTRY is not a valid OCI repository prefix');
  }
  const sourceSlug = repository.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
  return `${prefix.replace(/[-/]$/u, '')}-${sourceSlug}`;
}
