import { redirect } from 'next/navigation';

export default async function LegacyReleasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ env?: string; risk?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  if (resolvedSearchParams?.env) {
    query.set('env', resolvedSearchParams.env);
  }
  if (resolvedSearchParams?.risk) {
    query.set('risk', resolvedSearchParams.risk);
  }

  redirect(`/projects/${id}/delivery${query.toString() ? `?${query.toString()}` : ''}`);
}
