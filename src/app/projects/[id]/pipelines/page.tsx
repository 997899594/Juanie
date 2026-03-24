'use client';

import { Play, Plus, Trash2, Workflow } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

interface Pipeline {
  id: string;
  name: string;
  yaml: string;
  createdAt: string;
}

const defaultYaml = `name: Build and Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: echo "Building..."
      - name: Deploy
        run: echo "Deploying..."`;

export default function PipelinesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    yaml: defaultYaml,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines`);
      if (res.ok) {
        const data = await res.json();
        setPipelines(data);
      }
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsOpen(false);
        setFormData({ name: '', yaml: defaultYaml });
        fetchPipelines();
      }
    } catch (error) {
      console.error('Failed to create pipeline:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines/${deleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchPipelines();
      }
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const handleRun = async (pipelineId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to run pipeline:', error);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="流水线"
        description={`${pipelines.length} 条流水线`}
        actions={
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 rounded-xl px-4">
                <Plus className="h-4 w-4" />
                新建流水线
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>新建流水线</DialogTitle>
                  <DialogDescription>新增一条 CI/CD 流水线</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">名称</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="构建与部署"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yaml">YAML 配置</Label>
                    <Textarea
                      id="yaml"
                      value={formData.yaml}
                      onChange={(e) => setFormData({ ...formData, yaml: e.target.value })}
                      className="min-h-[220px] rounded-xl font-mono text-xs"
                      required
                    />
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
            <div key={i} className="h-40 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="console-panel flex min-h-80 flex-col items-center justify-center rounded-[20px] text-center">
          <div className="mb-4 rounded-2xl bg-muted p-4">
            <Workflow className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">还没有流水线</h2>
          <p className="mt-2 text-sm text-muted-foreground">添加一条流水线来自动化部署。</p>
          <Button className="mt-5 rounded-xl" onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4" />
            新建流水线
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="console-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">{pipeline.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    创建于 {new Date(pipeline.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => handleRun(pipeline.id)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    运行
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(pipeline.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <pre className="overflow-x-auto rounded-2xl bg-muted p-4 font-mono text-xs">
                  {pipeline.yaml}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除流水线</AlertDialogTitle>
            <AlertDialogDescription>确认删除这条流水线？该操作无法撤销。</AlertDialogDescription>
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
