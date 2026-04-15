import { Github } from 'lucide-react';
import { redirect } from 'next/navigation';
import { BrandLockup } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { auth, signIn } from '@/lib/auth';
import { devSignIn } from './actions';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="ui-floating flex items-center justify-center overflow-hidden px-8 py-10">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4">
              <BrandLockup href="/" size={52} priority />
              <div className="space-y-1">
                <h1 className="pt-2 text-3xl font-semibold tracking-tight">登录</h1>
              </div>
            </div>

            <div className="ui-control-muted p-4">
              <div className="grid gap-2">
                <div className="ui-control px-3 py-3 text-sm">项目</div>
                <div className="ui-control px-3 py-3 text-sm">交付</div>
                <div className="ui-control px-3 py-3 text-sm">运行</div>
              </div>
            </div>

            <div className="space-y-3">
              {process.env.NODE_ENV === 'development' ? (
                <form action={devSignIn}>
                  <Button type="submit" className="h-11 w-full rounded-xl">
                    以开发用户登录
                  </Button>
                </form>
              ) : (
                <>
                  <form
                    action={async () => {
                      'use server';
                      await signIn('github', { redirectTo: '/' });
                    }}
                  >
                    <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
                      <Github className="h-4 w-4" />
                      使用 GitHub 登录
                    </Button>
                  </form>

                  <form
                    action={async () => {
                      'use server';
                      await signIn('gitlab', { redirectTo: '/' });
                    }}
                  >
                    <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
                      使用 GitLab 登录
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hidden ui-floating overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="console-grid console-divider-bottom px-8 py-8">
            <BrandLockup
              href="/"
              size={40}
              className="gap-2.5"
              markClassName="rounded-xl"
              nameClassName="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            />
            <div className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
              清晰的交付主链
            </div>
          </div>

          <div className="grid gap-3 px-8 py-8">
            <div className="ui-control-muted px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                发布
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">1 条主链</div>
            </div>
            <div className="ui-control-muted px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                可观测
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">实时</div>
            </div>
            <div className="ui-control-muted px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                团队
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">共享</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
