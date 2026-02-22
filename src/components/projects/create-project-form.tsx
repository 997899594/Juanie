'use client';

import { Check, ChevronLeft, ChevronRight, GitBranch, Plus, Search, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { DatabaseConfig, ServiceConfig } from '@/lib/config/parser';
import { cn } from '@/lib/utils';

interface ServiceWithId extends ServiceConfig {
  _id: string;
}

interface DatabaseWithId extends DatabaseConfig {
  _id: string;
}

interface CreateProjectFormProps {
  gitProviderType: 'github' | 'gitlab' | 'gitlab-self-hosted';
  gitProviderId: string;
  teams: Array<{ id: string; name: string; slug: string }>;
}

type CreateMode = 'import' | 'create';
type Step = 'mode' | 'repository' | 'services' | 'databases' | 'config' | 'review';

interface FormData {
  mode: CreateMode;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  isPrivate: boolean;
  template: string;
  projectId: string;
  name: string;
  slug: string;
  description: string;
  teamId: string;
  services: ServiceWithId[];
  databases: DatabaseWithId[];
  domain: string;
  useCustomDomain: boolean;
  productionBranch: string;
  autoDeploy: boolean;
}

const STEPS: { id: Step; title: string }[] = [
  { id: 'mode', title: 'Create Mode' },
  { id: 'repository', title: 'Repository' },
  { id: 'services', title: 'Services' },
  { id: 'databases', title: 'Databases' },
  { id: 'config', title: 'Configuration' },
  { id: 'review', title: 'Review' },
];

const TEMPLATES = [
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'React framework with SSR',
    language: 'TypeScript',
  },
  { id: 'express', name: 'Express', description: 'Node.js REST API', language: 'TypeScript' },
  { id: 'fastapi', name: 'FastAPI', description: 'Python web framework', language: 'Python' },
  { id: 'go', name: 'Go API', description: 'Go REST API', language: 'Go' },
  { id: 'blank', name: 'Blank', description: 'Start from scratch', language: 'Docker' },
];

export function CreateProjectForm({
  gitProviderType,
  gitProviderId,
  teams,
}: CreateProjectFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    mode: 'import',
    repositoryId: '',
    repositoryName: '',
    repositoryFullName: '',
    isPrivate: false,
    template: 'nextjs',
    projectId: '',
    name: '',
    slug: '',
    description: '',
    teamId: teams[0]?.id || '',
    services: [
      { _id: nanoid(), name: 'web', type: 'web', run: { command: 'npm start', port: 3000 } },
    ],
    databases: [],
    domain: '',
    useCustomDomain: false,
    productionBranch: 'main',
    autoDeploy: true,
  });

  const [repositories, setRepositories] = useState<
    Array<{
      id: string;
      fullName: string;
      name: string;
      defaultBranch: string;
    }>
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const fetchRepositories = useCallback(
    async (search?: string) => {
      setIsLoadingRepos(true);
      try {
        const url = new URL('/api/git/repositories', window.location.origin);
        url.searchParams.set('providerId', gitProviderId);
        if (search) url.searchParams.set('search', search);

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRepositories(data);
        }
      } catch (error) {
        console.error('Failed to fetch repositories:', error);
      } finally {
        setIsLoadingRepos(false);
      }
    },
    [gitProviderId]
  );

  useEffect(() => {
    if (currentStep === 'repository' && formData.mode === 'import') {
      fetchRepositories();
    }
  }, [currentStep, formData.mode, fetchRepositories]);

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (formData.mode === 'import') {
      fetchRepositories(query);
    }
  };

  const selectRepository = (repo: (typeof repositories)[0]) => {
    setFormData((prev) => ({
      ...prev,
      repositoryId: repo.id,
      repositoryFullName: repo.fullName,
      repositoryName: repo.name,
      name: repo.name,
      slug: repo.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      productionBranch: repo.defaultBranch || 'main',
    }));
    handleNext();
  };

  const addService = () => {
    setFormData((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          _id: nanoid(),
          name: `service-${prev.services.length + 1}`,
          type: 'web',
          run: { command: '', port: 3000 },
        },
      ],
    }));
  };

  const removeService = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const updateService = (index: number, updates: Partial<ServiceConfig>) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
  };

  const addDatabase = () => {
    setFormData((prev) => ({
      ...prev,
      databases: [...prev.databases, { _id: nanoid(), name: 'database', type: 'postgresql' }],
    }));
  };

  const removeDatabase = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      databases: prev.databases.filter((_, i) => i !== index),
    }));
  };

  const updateDatabase = (index: number, updates: Partial<DatabaseConfig>) => {
    setFormData((prev) => ({
      ...prev,
      databases: prev.databases.map((d, i) => (i === index ? { ...d, ...updates } : d)),
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          gitProviderId,
        }),
      });

      if (res.ok) {
        const { project } = await res.json();
        router.push(`/projects/${project.id}/initializing`);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'mode':
        return true;
      case 'repository':
        if (formData.mode === 'import') {
          return !!formData.repositoryId;
        }
        return !!formData.repositoryName;
      case 'services':
        return (
          formData.services.length > 0 && formData.services.every((s) => s.name && s.run?.command)
        );
      case 'databases':
        return true;
      case 'config':
        return !!formData.name && !!formData.teamId;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm hidden sm:block',
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 sm:w-20 h-0.5 mx-2',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {currentStep === 'mode' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  How do you want to create your project?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Import an existing repository or create a new one
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, mode: 'import' }))}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition-colors',
                    formData.mode === 'import'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium mb-1">Import Repository</div>
                  <div className="text-sm text-muted-foreground">
                    Connect an existing Git repository
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, mode: 'create' }))}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition-colors',
                    formData.mode === 'create'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium mb-1">Create New</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new repository from template
                  </div>
                </button>
              </div>
            </div>
          )}

          {currentStep === 'repository' && (
            <div className="space-y-6">
              {formData.mode === 'import' ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Select Repository</h2>
                    <p className="text-sm text-muted-foreground">
                      Choose a repository from your{' '}
                      {gitProviderType === 'github' ? 'GitHub' : 'GitLab'} account
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search repositories..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>

                  <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                    {isLoadingRepos ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Loading repositories...
                      </div>
                    ) : repositories.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No repositories found
                      </div>
                    ) : (
                      repositories.map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => selectRepository(repo)}
                          className={cn(
                            'w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between',
                            formData.repositoryId === repo.id && 'bg-muted'
                          )}
                        >
                          <div>
                            <div className="font-medium">{repo.fullName}</div>
                            <div className="text-xs text-muted-foreground">
                              {repo.defaultBranch}
                            </div>
                          </div>
                          {formData.repositoryId === repo.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Create New Repository</h2>
                    <p className="text-sm text-muted-foreground">
                      Create a new repository from a template
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Repository Name</Label>
                      <Input
                        value={formData.repositoryName}
                        onChange={(e) => {
                          const name = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            repositoryName: name,
                            name,
                            slug: name
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/^-|-$/g, ''),
                          }));
                        }}
                        placeholder="my-awesome-project"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            checked={!formData.isPrivate}
                            onChange={() => setFormData((prev) => ({ ...prev, isPrivate: false }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Public</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            checked={formData.isPrivate}
                            onChange={() => setFormData((prev) => ({ ...prev, isPrivate: true }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Private</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Template</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, template: template.id }))
                            }
                            className={cn(
                              'p-3 rounded-lg border text-left transition-colors',
                              formData.template === template.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            <div className="font-medium text-sm">{template.name}</div>
                            <div className="text-xs text-muted-foreground">{template.language}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === 'services' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Configure Services</h2>
                <p className="text-sm text-muted-foreground">
                  Define the services that make up your application
                </p>
              </div>

              <div className="space-y-4">
                {formData.services.map((service, index) => (
                  <div key={service._id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Service {index + 1}</span>
                      {formData.services.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeService(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={service.name}
                          onChange={(e) => updateService(index, { name: e.target.value })}
                          placeholder="web"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={service.type}
                          onValueChange={(value) =>
                            updateService(index, { type: value as ServiceConfig['type'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="web">Web Service</SelectItem>
                            <SelectItem value="worker">Background Worker</SelectItem>
                            <SelectItem value="cron">Scheduled Job</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Build Command</Label>
                        <Input
                          value={service.build?.command || ''}
                          onChange={(e) =>
                            updateService(index, {
                              build: { ...service.build, command: e.target.value },
                            })
                          }
                          placeholder="npm run build"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Start Command</Label>
                        <Input
                          value={service.run?.command || ''}
                          onChange={(e) =>
                            updateService(index, {
                              run: { ...service.run, command: e.target.value },
                            })
                          }
                          placeholder="npm start"
                        />
                      </div>
                    </div>

                    {service.type === 'web' && (
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Input
                          type="number"
                          value={service.run?.port || ''}
                          onChange={(e) =>
                            updateService(index, {
                              run: { ...service.run, port: parseInt(e.target.value, 10) },
                            })
                          }
                          placeholder="3000"
                          className="w-32"
                        />
                      </div>
                    )}

                    {service.type === 'cron' && (
                      <div className="space-y-2">
                        <Label>Schedule (Cron)</Label>
                        <Input
                          value={service.schedule || ''}
                          onChange={(e) => updateService(index, { schedule: e.target.value })}
                          placeholder="0 */6 * * *"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <Button variant="outline" onClick={addService} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'databases' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Add Databases (Optional)</h2>
                <p className="text-sm text-muted-foreground">
                  Add managed databases for your application
                </p>
              </div>

              <div className="space-y-4">
                {formData.databases.map((database, index) => (
                  <div key={database._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">Database {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDatabase(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={database.name}
                          onChange={(e) => updateDatabase(index, { name: e.target.value })}
                          placeholder="postgres"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={database.type}
                          onValueChange={(value) =>
                            updateDatabase(index, { type: value as DatabaseConfig['type'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="postgresql">PostgreSQL</SelectItem>
                            <SelectItem value="mysql">MySQL</SelectItem>
                            <SelectItem value="redis">Redis</SelectItem>
                            <SelectItem value="mongodb">MongoDB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <Select
                          value={database.plan || 'starter'}
                          onValueChange={(value) =>
                            updateDatabase(index, { plan: value as DatabaseConfig['plan'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}

                {formData.databases.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>No databases added</p>
                    <p className="text-sm mt-1">You can add databases later in project settings</p>
                  </div>
                )}

                <Button variant="outline" onClick={addDatabase} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Database
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'config' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Project Configuration</h2>
                <p className="text-sm text-muted-foreground">Configure your project settings</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          name,
                          slug: name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        }));
                      }}
                      placeholder="my-project"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="my-project"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="A brief description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select
                      value={formData.teamId}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, teamId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Production Branch</Label>
                    <div className="relative">
                      <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={formData.productionBranch}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, productionBranch: e.target.value }))
                        }
                        placeholder="main"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto Deploy</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically deploy when pushing to the production branch
                      </p>
                    </div>
                    <Switch
                      checked={formData.autoDeploy}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, autoDeploy: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Custom Domain</Label>
                      <p className="text-sm text-muted-foreground">
                        Use a custom domain instead of the default
                      </p>
                    </div>
                    <Switch
                      checked={formData.useCustomDomain}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, useCustomDomain: checked }))
                      }
                    />
                  </div>

                  {formData.useCustomDomain && (
                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Input
                        value={formData.domain}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, domain: e.target.value }))
                        }
                        placeholder="myapp.com"
                      />
                    </div>
                  )}

                  {!formData.useCustomDomain && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Default domain:{' '}
                        <span className="font-mono">
                          {formData.slug || 'my-project'}.juanie.dev
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Review & Create</h2>
                <p className="text-sm text-muted-foreground">
                  Review your project configuration before creating
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Project Name</p>
                    <p className="font-medium">{formData.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Slug</p>
                    <p className="font-medium font-mono">{formData.slug || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Repository</p>
                    <p className="font-medium">
                      {formData.mode === 'import'
                        ? formData.repositoryFullName
                        : `${formData.repositoryName} (new)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Team</p>
                    <p className="font-medium">
                      {teams.find((t) => t.id === formData.teamId)?.name || '-'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Services</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.services.map((service) => (
                      <Badge key={service.name} variant="secondary">
                        {service.name} ({service.type})
                      </Badge>
                    ))}
                  </div>
                </div>

                {formData.databases.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Databases</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.databases.map((db) => (
                        <Badge key={db.name} variant="secondary">
                          {db.name} ({db.type})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Domain</p>
                  <p className="font-medium font-mono">
                    {formData.useCustomDomain ? formData.domain : `${formData.slug}.juanie.dev`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={formData.autoDeploy ? 'default' : 'secondary'}>
                    Auto Deploy: {formData.autoDeploy ? 'On' : 'Off'}
                  </Badge>
                  <Badge variant="secondary">Branch: {formData.productionBranch}</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={handleBack} disabled={isFirstStep}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
