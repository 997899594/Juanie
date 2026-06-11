'use client';

import { AlertCircle, ArrowLeft, Home, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { BrandLockup } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';

interface AppErrorStateProps {
  eyebrow?: string;
  title: string;
  summary: string;
  operatorHint?: string;
  code?: string | null;
  detail?: string | null;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function AppErrorState({
  eyebrow = '服务异常',
  title,
  summary,
  operatorHint,
  code,
  detail,
  primaryAction,
  secondaryAction = { label: '返回首页', href: '/' },
}: AppErrorStateProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-8">
        <div className="w-full overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(249,247,243,0.94))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_24px_60px_rgba(55,53,47,0.08)]">
          <div className="console-grid console-divider-bottom px-8 py-8 sm:px-10">
            <BrandLockup href="/" size={44} priority />
            <div className="mt-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(196,85,77,0.09)] px-3 py-1 text-sm font-medium text-destructive shadow-[0_0_0_1px_rgba(196,85,77,0.12)]">
                <AlertCircle className="h-4 w-4" />
                {eyebrow}
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {title}
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">{summary}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-8 py-8 sm:px-10 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[22px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] p-5 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                可以先这样处理
              </div>
              <div className="mt-4 grid gap-3">
                {primaryAction ? (
                  primaryAction.href ? (
                    <Button asChild className="h-11 justify-start px-4">
                      <Link href={primaryAction.href}>
                        <RotateCcw className="h-4 w-4" />
                        {primaryAction.label}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-11 justify-start px-4"
                      onClick={primaryAction.onClick}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {primaryAction.label}
                    </Button>
                  )
                ) : null}
                <Button asChild variant="secondary" className="h-11 justify-start px-4">
                  <Link href={secondaryAction.href}>
                    {secondaryAction.href === '/' ? (
                      <Home className="h-4 w-4" />
                    ) : (
                      <ArrowLeft className="h-4 w-4" />
                    )}
                    {secondaryAction.label}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[22px] bg-white/72 p-5 shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_0_0_1px_rgba(17,17,17,0.035)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                管理员排查
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {operatorHint ??
                  '请查看服务端日志和最近的发布记录，确认外部依赖、数据库和运行时配置是否正常。'}
              </p>
              {code ? (
                <div className="mt-4 rounded-2xl bg-[rgba(248,246,242,0.92)] px-4 py-3 font-mono text-xs text-muted-foreground">
                  错误编号：{code}
                </div>
              ) : null}
              {detail ? (
                <pre className="mt-3 max-h-44 overflow-auto rounded-2xl bg-[rgba(248,246,242,0.92)] px-4 py-3 text-xs leading-5 text-muted-foreground">
                  {detail}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
