import { redirect } from 'next/navigation';

export default async function ProjectEnvironmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const suffix = resolvedSearchParams?.new === 'preview' ? '?new=preview' : '';

  redirect(`/projects/${id}${suffix}`);
}
