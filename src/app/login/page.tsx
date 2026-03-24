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
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="console-panel flex items-center justify-center px-8 py-10">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-lg font-semibold text-background">
                J
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
                <p className="text-sm text-muted-foreground">
                  在一个控制台里管理发布、迁移和运行状态。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {process.env.NODE_ENV === 'development' ? (
                <form action={devSignIn}>
                  <Button type="submit" className="h-11 w-full rounded-xl">
                    以开发用户登录
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">当前为开发模式</p>
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

            <div className="text-xs text-muted-foreground">
              继续即表示你同意服务条款与隐私政策。
            </div>
          </div>
        </div>

        <div className="hidden console-panel overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="border-b border-border/70 px-8 py-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Juanie
            </div>
            <div className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
              面向现代应用团队的发布控制台。
            </div>
          </div>

          <div className="grid gap-3 px-8 py-8">
            <div className="rounded-[18px] border border-border/70 bg-secondary/40 px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                发布
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">1 条主链</div>
              <div className="mt-1 text-sm text-muted-foreground">迁移、部署、审批</div>
            </div>
            <div className="rounded-[18px] border border-border/70 bg-secondary/40 px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                可观测
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">实时</div>
              <div className="mt-1 text-sm text-muted-foreground">日志、状态、待处理项</div>
            </div>
            <div className="rounded-[18px] border border-border/70 bg-secondary/40 px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                团队
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">共享</div>
              <div className="mt-1 text-sm text-muted-foreground">项目、成员、环境</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
