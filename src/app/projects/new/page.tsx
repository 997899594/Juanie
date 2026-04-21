import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/projects/create-project-form';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getCreateProjectPageData } from '@/lib/projects/create-service';

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getCreateProjectPageData(session.user.id);

  if (pageData.teamScopes.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="新建项目"
          actions={
            <Button asChild variant="ghost" className="h-9 rounded-full px-4">
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Link>
            </Button>
          }
        />

        <div className="console-panel flex min-h-72 flex-col items-center justify-center rounded-[20px] px-8 text-center">
          <h2 className="text-lg font-medium">没有可用团队</h2>
          <Link href="/teams/new" className="mt-5">
            <Button className="rounded-full px-4">创建团队</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="新建项目"
        actions={
          <Button asChild variant="ghost" className="h-9 rounded-full px-4">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />

      <div className="console-panel px-5 py-5">
        <CreateProjectForm teamScopes={pageData.teamScopes} templates={pageData.templates} />
      </div>
    </div>
  );
}
