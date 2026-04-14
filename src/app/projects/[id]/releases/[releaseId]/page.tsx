import { redirect } from 'next/navigation';

export default async function LegacyReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; releaseId: string }>;
}) {
  const { id, releaseId } = await params;
  redirect(`/projects/${id}/delivery/${releaseId}`);
}
