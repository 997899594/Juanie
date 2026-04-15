'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData.user.name ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setUser((prev) => ({
          ...prev,
          ...data,
        }));
      }
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="h-9 px-4">
              <Link href="/settings/integrations">集成</Link>
            </Button>
            <Button variant="outline" className="h-9 px-4" onClick={handleSignOut}>
              退出登录
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {initialData.overview.stats.map((stat) => (
          <div key={stat.label} className="ui-control-muted rounded-[20px] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="ui-floating px-5 py-5">
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

          <form onSubmit={handleSubmit} className="grid flex-1 gap-4 md:max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">
                显示名称
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="输入你的名称"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">邮箱地址</Label>
              <div className="ui-control-muted px-4 py-3 text-sm text-muted-foreground">
                {user.email}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="h-9 px-4" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="ui-floating overflow-hidden">
        <div className="console-divider-bottom px-5 py-4">
          <div className="text-sm font-semibold">代码托管连接</div>
        </div>
        <div className="space-y-2 p-3">
          {initialData.overview.integrations.length === 0 ? (
            <div className="ui-control-muted flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              暂无代码托管连接
            </div>
          ) : (
            initialData.overview.integrations.map((integration) => (
              <div key={integration.id} className="ui-control px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{integration.provider}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {integration.accountLabel}
                    </div>
                  </div>
                  <Badge variant={integration.statusTone === 'danger' ? 'destructive' : 'outline'}>
                    {integration.statusLabel}
                  </Badge>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {integration.capabilities.length > 0
                    ? integration.capabilities.join(' · ')
                    : '未识别能力'}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{integration.summary}</div>
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
