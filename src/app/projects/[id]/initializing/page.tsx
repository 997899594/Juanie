import { notFound, redirect } from 'next/navigation';
import { ProjectInitializingClient } from '@/components/projects/ProjectInitializingClient';
import { auth } from '@/lib/auth';
import { getProjectInitPageData } from '@/lib/projects/init-service';

export default async function InitializingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getProjectInitPageData(id, session.user.id);

  if (!pageData) {
    notFound();
  }

  return <ProjectInitializingClient projectId={id} initialData={pageData} />;
}
