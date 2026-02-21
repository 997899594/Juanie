import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Juanie</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user?.email}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/projects" className="block">
            <div className="p-6 border rounded-lg hover:bg-muted transition-colors">
              <h2 className="text-xl font-semibold mb-2">Projects</h2>
              <p className="text-muted-foreground">Manage your projects and deployments</p>
            </div>
          </Link>

          <Link href="/teams" className="block">
            <div className="p-6 border rounded-lg hover:bg-muted transition-colors">
              <h2 className="text-xl font-semibold mb-2">Teams</h2>
              <p className="text-muted-foreground">Manage your teams and members</p>
            </div>
          </Link>

          <Link href="/settings" className="block">
            <div className="p-6 border rounded-lg hover:bg-muted transition-colors">
              <h2 className="text-xl font-semibold mb-2">Settings</h2>
              <p className="text-muted-foreground">Configure your account and integrations</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
