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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add Pipeline</DialogTitle>
                <DialogDescription>Create a new CI/CD pipeline</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Build and Deploy"
                    className="h-9"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yaml" className="text-sm">
                    YAML Configuration
                  </Label>
                  <Textarea
                    id="yaml"
                    value={formData.yaml}
                    onChange={(e) => setFormData({ ...formData, yaml: e.target.value })}
                    className="min-h-[200px] font-mono text-xs"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Workflow className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-2">No pipelines yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Add a CI/CD pipeline to automate your deployments
          </p>
          <Button size="sm" className="h-8" onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Pipeline
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <p className="font-medium">{pipeline.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(pipeline.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleRun(pipeline.id)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(pipeline.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
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
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pipeline? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
