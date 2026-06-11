export interface SchemaRevisionSnapshot {
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}

export function normalizeSchemaRevision(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function buildSchemaRevisionKey(input: SchemaRevisionSnapshot): string {
  const sourceCommitSha = normalizeSchemaRevision(input.sourceCommitSha);
  if (sourceCommitSha) {
    return `commit:${sourceCommitSha}`;
  }

  const sourceRef = normalizeSchemaRevision(input.sourceRef);
  if (sourceRef) {
    return `ref:${sourceRef}`;
  }

  return 'unversioned';
}

export function isSchemaStateForRequestedRevision(
  state: SchemaRevisionSnapshot,
  requested: SchemaRevisionSnapshot
): boolean {
  const requestedCommitSha = normalizeSchemaRevision(requested.sourceCommitSha);
  const requestedRef = normalizeSchemaRevision(requested.sourceRef);

  if (requestedCommitSha) {
    return state.sourceCommitSha === requestedCommitSha;
  }

  if (requestedRef) {
    return state.sourceRef === requestedRef && !state.sourceCommitSha;
  }

  return !state.sourceRef && !state.sourceCommitSha;
}
