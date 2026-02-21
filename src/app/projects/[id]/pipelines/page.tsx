'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [formData, setFormData] = useState({
    name: '',
    yaml: defaultYaml,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPipelines();
  }, [projectId]);

  const fetchPipelines = async () => {
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
  };

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
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create pipeline');
      }
    } catch (error) {
      console.error('Failed to create pipeline:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pipelineId: string) => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchPipelines();
      }
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
    }
  };

  const handleRun = async (pipelineId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
        method: 'POST',
      });

      if (res.ok) {
        alert('Pipeline run started!');
      }
    } catch (error) {
      console.error('Failed to run pipeline:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground">CI/CD pipelines for your project</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add Pipeline</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add Pipeline</DialogTitle>
                <DialogDescription>Create a new CI/CD pipeline for your project.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Pipeline Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Build and Deploy"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yaml">YAML Configuration</Label>
                  <textarea
                    id="yaml"
                    value={formData.yaml}
                    onChange={(e) => setFormData({ ...formData, yaml: e.target.value })}
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {pipelines.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pipelines configured. Add a pipeline to get started.
            </CardContent>
          </Card>
        ) : (
          pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRun(pipeline.id)}>
                      Run
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(pipeline.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Created {new Date(pipeline.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {pipeline.yaml}
                </pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
