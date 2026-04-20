export type PreviewDatabaseStrategy = 'inherit' | 'isolated_clone';

export function resolveProjectPreviewDatabaseStrategy(
  projectConfigJson: unknown,
  requestedStrategy?: PreviewDatabaseStrategy | null
): PreviewDatabaseStrategy {
  if (requestedStrategy === 'inherit' || requestedStrategy === 'isolated_clone') {
    return requestedStrategy;
  }

  const configJson =
    projectConfigJson && typeof projectConfigJson === 'object'
      ? (projectConfigJson as Record<string, unknown>)
      : null;
  const creationDefaults =
    configJson?.creationDefaults && typeof configJson.creationDefaults === 'object'
      ? (configJson.creationDefaults as Record<string, unknown>)
      : null;

  return creationDefaults?.previewDatabaseStrategy === 'isolated_clone'
    ? 'isolated_clone'
    : 'inherit';
}
