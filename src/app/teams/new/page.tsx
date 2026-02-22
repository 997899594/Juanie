'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        setError(data.error || 'Failed to create team');
        return;
      }

      router.push(`/teams/${data.id}`);
    } catch (_err) {
      setError('Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link
          href="/teams"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to teams
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Create a team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Teams let you collaborate with others on projects
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Team Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Team"
              className="h-9"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm">
              Slug
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="my-team"
                className="h-9 flex-1"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Used in URLs and as namespace prefix</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/teams">
            <Button type="button" variant="outline" size="sm" className="h-8">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="sm"
            className="h-8"
            disabled={loading || !formData.name || !formData.slug}
          >
            {loading ? 'Creating...' : 'Create Team'}
          </Button>
        </div>
      </form>
    </div>
  );
}
