import { redirect } from 'next/navigation';

export default async function LegacyEnvironmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ env?: string; panel?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();

  if (resolvedSearchParams?.env) {
    query.set('env', resolvedSearchParams.env);
  }

  if (resolvedSearchParams?.panel) {
    query.set('panel', resolvedSearchParams.panel);
  }

  redirect(`/projects/${id}/runtime${query.toString() ? `?${query.toString()}` : ''}`);
}
