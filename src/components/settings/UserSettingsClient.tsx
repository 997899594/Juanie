'use client';

import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSection,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';

interface UserSettingsClientProps {
  initialData: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      createdAt: string | Date;
    };
    overview: {
      headerDescription: string;
      stats: Array<{
        label: string;
        value: string;
      }>;
      integrations: Array<{
        id: string;
        provider: string;
        accountLabel: string;
        statusLabel: string;
        statusTone: 'danger' | 'neutral';
        capabilities: string[];
        summary: string;
        connectedAtLabel: string;
      }>;
    };
  };
}

export function UserSettingsClient({ initialData }: UserSettingsClientProps) {
  const [user, setUser] = useState(initialData.user);
  const form = useForm({
    defaultValues: {
      name: initialData.user.name ?? '',
    },
    onSubmit: async ({ value }) => {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });

      if (!res.ok) {
        throw new Error('保存失败');
      }

      const data = await res.json();
      setUser((prev) => ({
        ...prev,
        ...data,
      }));
      toast.success('设置已保存');
    },
  });

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return email[0]?.toUpperCase() ?? '?';
  };
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';
  const subtleClassName =
    'rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.78),rgba(255,255,255,0.88))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.03)]';

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="h-9 rounded-full px-4">
              <Link href="/settings/integrations">集成</Link>
            </Button>
            <Button variant="ghost" className="h-9 rounded-full px-4" onClick={handleSignOut}>
              退出登录
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {initialData.overview.stats.map((stat) => (
          <div key={stat.label} className={`${subtleClassName} rounded-[20px] px-4 py-3`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-1.5 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className={`${shellClassName} px-5 py-5`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-2xl">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="rounded-2xl bg-secondary text-sm font-semibold">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-semibold">{user.name || '用户'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <form
            className="flex-1 md:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit().catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : '保存失败');
              });
            }}
          >
            <FormSection className="space-y-5 px-0 py-0 shadow-none">
              <form.Field name="name">
                {(field) => (
                  <FormField>
                    <FormLabel htmlFor={field.name}>显示名称</FormLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="输入你的名称"
                    />
                    <FormDescription>显示在头像和成员列表。</FormDescription>
                    <FormMessage />
                  </FormField>
                )}
              </form.Field>

              <FormField>
                <FormLabel htmlFor="user-email">邮箱地址</FormLabel>
                <div
                  id="user-email"
                  className="rounded-[18px] bg-[rgba(243,240,233,0.72)] px-4 py-3 text-sm text-muted-foreground"
                >
                  {user.email}
                </div>
              </FormField>

              <div className="flex justify-end">
                <form.Subscribe
                  selector={(state) => ({
                    canSubmit: state.canSubmit,
                    isSubmitting: state.isSubmitting,
                  })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button type="submit" className="h-9 px-4" disabled={!canSubmit}>
                      {isSubmitting ? '保存中...' : '保存'}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </FormSection>
          </form>
        </div>
      </div>

      <div className={`${shellClassName} overflow-hidden`}>
        <div className="console-divider-bottom px-5 py-4">
          <div className="text-sm font-semibold">代码托管连接</div>
        </div>
        <div className="space-y-2 p-3">
          {initialData.overview.integrations.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-[18px] bg-[rgba(243,240,233,0.66)] text-sm text-muted-foreground">
              暂无代码托管连接
            </div>
          ) : (
            initialData.overview.integrations.map((integration) => (
              <div
                key={integration.id}
                className="rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.72),rgba(255,255,255,0.88))] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset,0_0_0_1px_rgba(17,17,17,0.028)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{integration.provider}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {integration.accountLabel}
                    </div>
                  </div>
                  <Badge
                    variant={integration.statusTone === 'danger' ? 'destructive' : 'secondary'}
                  >
                    {integration.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {integration.capabilities.length > 0
                    ? integration.capabilities.join(' · ')
                    : '未识别能力'}
                </div>
                {integration.summary ? (
                  <div className="mt-3 text-xs text-muted-foreground">{integration.summary}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  最近记录：{integration.connectedAtLabel}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
