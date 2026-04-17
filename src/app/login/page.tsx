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
        <div className="flex items-center justify-center overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] px-8 py-10 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_20px_44px_rgba(55,53,47,0.06)]">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4">
              <BrandLockup href="/" size={52} priority />
              <div className="space-y-1">
                <h1 className="pt-2 text-3xl font-semibold tracking-tight">登录</h1>
              </div>
            </div>

            <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] p-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
              <div className="grid gap-2">
                <div className="rounded-[18px] bg-white/82 px-3 py-3 text-sm shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                  项目
                </div>
                <div className="rounded-[18px] bg-white/82 px-3 py-3 text-sm shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                  环境
                </div>
                <div className="rounded-[18px] bg-white/82 px-3 py-3 text-sm shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                  发布
                </div>
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

        <div className="hidden overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] lg:flex lg:flex-col lg:justify-between lg:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_20px_44px_rgba(55,53,47,0.06)]">
          <div className="console-grid console-divider-bottom px-8 py-8">
            <BrandLockup
              href="/"
              size={40}
              className="gap-2.5"
              markClassName="rounded-xl"
              nameClassName="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            />
            <div className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
              项目进入环境，环境进入发布
            </div>
          </div>

          <div className="grid gap-3 px-8 py-8">
            <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                发布
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">1 条主链</div>
            </div>
            <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                可观测
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">实时</div>
            </div>
            <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
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
