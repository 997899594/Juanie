import { redirect } from 'next/navigation';

type LegacyRuntimeSection = '' | 'diagnostics' | 'logs' | 'variables';

interface RedirectLegacyRuntimeInput {
  projectId: string;
  environmentId?: string | null;
  section?: LegacyRuntimeSection;
}

// Keep legacy /runtime routes as thin compatibility redirects only.
export function redirectLegacyRuntimeRoute({
  projectId,
  environmentId,
  section = '',
}: RedirectLegacyRuntimeInput): never {
  if (!environmentId) {
    redirect(`/projects/${projectId}/environments`);
  }

  const sectionSuffix = section ? `/${section}` : '';
  redirect(`/projects/${projectId}/environments/${environmentId}${sectionSuffix}`);
}
