import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { Button } from '@/components/ui/button';
import { PageBackAction, PageHeader } from '@/components/ui/page-header';
import { PagePanel, PageShell } from '@/components/ui/page-shell';
import { auth } from '@/lib/auth';
import { getCreateProjectPageData } from '@/lib/projects/create-page-service';

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getCreateProjectPageData(session.user.id);

  if (pageData.teamScopes.length === 0) {
    return (
      <PageShell size="form">
        <PageHeader title="新建项目" actions={<PageBackAction href="/projects" />} />

        <PagePanel className="flex min-h-72 flex-col items-center justify-center px-8 text-center">
          <h2 className="text-lg font-medium">没有可用团队</h2>
          <Link href="/teams/new" className="mt-5">
            <Button className="rounded-full px-4">创建团队</Button>
          </Link>
        </PagePanel>
      </PageShell>
    );
  }

  return (
    <PageShell size="content">
      <PageHeader title="新建项目" actions={<PageBackAction href="/projects" />} />

      <PagePanel>
        <CreateProjectForm teamScopes={pageData.teamScopes} templates={pageData.templates} />
      </PagePanel>
    </PageShell>
  );
}
