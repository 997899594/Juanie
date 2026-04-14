import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  redirect(`/projects/${id}/runtime`);
}
