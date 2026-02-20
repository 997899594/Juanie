'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ProjectSettings {
  id: string
  name: string
  slug: string
  description: string | null
  gitRepository: string | null
  gitBranch: string
  status: string
  teamName: string
  teamSlug: string
  yourRole: string
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<ProjectSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitRepository: '',
    gitBranch: 'main',
  })

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
        setFormData({
          name: data.name || '',
          description: data.description || '',
          gitRepository: data.gitRepository || '',
          gitBranch: data.gitBranch || 'main',
        })
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        setProject(data)
        alert('Project updated successfully')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to update project')
      }
    } catch (error) {
      console.error('Failed to update project:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/projects')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!project) {
    return <div>Project not found</div>
  }

  const canEdit = ['owner', 'admin'].includes(project.yourRole)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground">Manage your project settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic information about your project</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Team</Label>
                  <p className="text-sm text-muted-foreground">{project.teamName}</p>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Badge variant={project.status === 'active' ? 'success' : 'warning'}>
                    {project.status}
                  </Badge>
                </div>

                {canEdit && (
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="git">
          <Card>
            <CardHeader>
              <CardTitle>Git Settings</CardTitle>
              <CardDescription>Configure your Git repository</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gitRepository">Repository URL</Label>
                  <Input
                    id="gitRepository"
                    placeholder="https://github.com/owner/repo"
                    value={formData.gitRepository}
                    onChange={(e) => setFormData({ ...formData, gitRepository: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitBranch">Branch</Label>
                  <Input
                    id="gitBranch"
                    value={formData.gitBranch}
                    onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>

                {canEdit && (
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              {project.yourRole === 'owner' ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Once you delete a project, there is no going back. Please be certain.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete Project
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only the project owner can delete this project.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
