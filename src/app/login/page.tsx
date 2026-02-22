import { Github } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth, signIn } from '@/lib/auth';
import { devSignIn } from './actions';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white text-lg font-bold">
              J
            </div>
            <h1 className="text-xl font-semibold">Sign in to Juanie</h1>
          </div>

          <div className="space-y-3">
            {process.env.NODE_ENV === 'development' ? (
              <form action={devSignIn}>
                <Button type="submit" className="w-full h-10">
                  Sign in as Dev User
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">Dev mode enabled</p>
              </form>
            ) : (
              <>
                <form
                  action={async () => {
                    'use server';
                    await signIn('github', { redirectTo: '/' });
                  }}
                >
                  <Button type="submit" variant="outline" className="w-full h-10">
                    <Github className="mr-2 h-4 w-4" />
                    Continue with GitHub
                  </Button>
                </form>

                <form
                  action={async () => {
                    'use server';
                    await signIn('gitlab', { redirectTo: '/' });
                  }}
                >
                  <Button type="submit" variant="outline" className="w-full h-10">
                    Continue with GitLab
                  </Button>
                </form>
              </>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our{' '}
            <span className="underline hover:text-foreground cursor-pointer">Terms of Service</span>{' '}
            and{' '}
            <span className="underline hover:text-foreground cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-zinc-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10 max-w-md text-center px-8">
          <h2 className="text-3xl font-semibold text-white mb-4">Deploy with confidence</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Juanie provides automated CI/CD, Kubernetes management, and GitOps workflows in one
            unified platform.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-12">
            <div>
              <div className="text-2xl font-semibold text-white">99.9%</div>
              <div className="text-xs text-zinc-500 mt-1">Uptime SLA</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">50+</div>
              <div className="text-xs text-zinc-500 mt-1">Templates</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">5min</div>
              <div className="text-xs text-zinc-500 mt-1">Deploy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
