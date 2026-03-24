'use client';

import { signOut } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/user');
      if (res.ok) {
        const data = (await res.json()) as UserData;
        setUser(data);
        setFormData({ name: data.name || '' });
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

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
        const data = (await res.json()) as UserData;
        setUser(data);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
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

    return email[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[20px] bg-muted" />
        <div className="h-44 animate-pulse rounded-[20px] bg-muted" />
      </div>
    );
  }

  const stats = [
    {
      label: '加入时间',
      value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-',
    },
    {
      label: '账户',
      value: user?.id ? `${user.id.slice(0, 8)}...` : '-',
    },
    {
      label: '邮箱',
      value: user?.email ?? '-',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="设置"
        description="个人资料与账户"
        actions={
          <Button variant="outline" className="h-9 rounded-xl px-4" onClick={handleSignOut}>
            退出登录
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="console-panel px-5 py-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-2xl">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback className="rounded-2xl bg-secondary text-sm font-semibold">
                {user ? getInitials(user.name, user.email) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-semibold">{user?.name || '用户'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入你的名称"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">邮箱地址</Label>
              <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                {user?.email}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="h-9 rounded-xl px-4" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="console-panel px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">退出登录</div>
            <div className="mt-1 text-xs text-muted-foreground">结束当前会话并返回登录页。</div>
          </div>
          <Button variant="outline" className="h-9 rounded-xl px-4" onClick={handleSignOut}>
            退出登录
          </Button>
        </div>
      </div>
    </div>
  );
}
