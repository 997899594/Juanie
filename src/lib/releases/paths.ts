export function buildReleaseDetailPath(
  projectId: string,
  environmentId: string,
  releaseId: string
): string {
  return `/projects/${projectId}/environments/${environmentId}/delivery/${releaseId}`;
}
