import { redirect } from 'next/navigation';

export default async function LegacyLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ env?: string }>;
}) {
  const { id } = await params;
  const { env } = await searchParams;
  redirect(`/projects/${id}/runtime/logs${env ? `?env=${env}` : ''}`);
}
