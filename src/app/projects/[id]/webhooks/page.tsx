'use client';

import { Copy, Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

const eventOptions = [
  { value: 'deployment', label: '发布' },
  { value: 'rollback', label: '回滚' },
  { value: 'health_check', label: '健康检查' },
];

function formatWebhookEventLabel(event: string): string {
  return eventOptions.find((option) => option.value === event)?.label ?? event;
}

export default function WebhooksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    events: ['deployment'],
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsOpen(false);
        setFormData({ url: '', events: ['deployment'] });
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (webhook: Webhook) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !webhook.active }),
      });

      if (res.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks/${deleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const copySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="回调"
        description={`${webhooks.length} 个回调`}
        actions={
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 rounded-xl px-4">
                <Plus className="h-4 w-4" />
                新建回调
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>新建回调</DialogTitle>
                  <DialogDescription>接收部署事件通知</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      placeholder="https://example.com/webhook"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>事件</Label>
                    <Select
                      value={formData.events[0]}
                      onValueChange={(value) => setFormData({ ...formData, events: [value] })}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {eventOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setIsOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" className="rounded-xl" disabled={submitting}>
                    {submitting ? '创建中...' : '创建'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <WebhookIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有回调</h2>
          <p className="mt-2 text-sm text-muted-foreground">添加一个回调来接收部署事件通知。</p>
          <Button className="mt-5 rounded-xl" onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4" />
            新建回调
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="console-panel px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{webhook.url}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        webhook.active
                          ? 'border border-border bg-secondary/30 text-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {webhook.active ? '启用中' : '未启用'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {formatWebhookEventLabel(event)}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                      {webhook.secret.slice(0, 8)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-3 text-xs"
                      onClick={() => copySecret(webhook.id, webhook.secret)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === webhook.id ? '已复制' : '复制密钥'}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 xl:ml-4">
                  <Switch checked={webhook.active} onCheckedChange={() => handleToggle(webhook)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除回调</AlertDialogTitle>
            <AlertDialogDescription>确认删除这个回调？该操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
