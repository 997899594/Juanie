'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';

export default function NewTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      name,
      slug: generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '创建团队失败');
        return;
      }

      router.push(`/teams/${data.id}`);
    } catch (_err) {
      setError('创建团队失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="新建团队"
        actions={
          <Button asChild variant="outline" className="h-9 rounded-xl px-4">
            <Link href="/teams">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="console-panel space-y-6 px-5 py-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              团队名称
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="我的团队"
              className="h-11 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm">
              标识
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="my-team"
                className="h-11 flex-1 rounded-xl"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">用于 URL 和命名空间前缀</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/teams">
            <Button type="button" variant="outline" className="h-9 rounded-xl px-4">
              取消
            </Button>
          </Link>
          <Button
            type="submit"
            className="h-9 rounded-xl px-4"
            disabled={loading || !formData.name || !formData.slug}
          >
            {loading ? '创建中...' : '创建团队'}
          </Button>
        </div>
      </form>
    </div>
  );
}
