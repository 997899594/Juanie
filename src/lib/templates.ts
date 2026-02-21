import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { join, relative } from 'path';

export interface TemplateVariables {
  projectName: string;
  projectSlug: string;
  teamName: string;
  description?: string;
  nodeVersion?: string;
}

const TEMPLATES_DIR = join(process.cwd(), 'templates');

export class TemplateService {
  private templateId: string;
  private variables: TemplateVariables;

  constructor(templateId: string, variables: TemplateVariables) {
    this.templateId = templateId;
    this.variables = variables;
  }

  async renderToMemory(): Promise<Map<string, string>> {
    const templatePath = join(TEMPLATES_DIR, this.templateId);

    if (!existsSync(templatePath)) {
      throw new Error(`Template ${this.templateId} not found`);
    }

    const files = new Map<string, string>();
    this.processDirectory(templatePath, templatePath, files);

    return files;
  }

  private processDirectory(dirPath: string, basePath: string, files: Map<string, string>): void {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(basePath, fullPath);

      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        this.processDirectory(fullPath, basePath, files);
      } else if (entry.isFile()) {
        const content = readFileSync(fullPath, 'utf-8');
        const rendered = this.renderTemplate(content);
        files.set(relativePath, rendered);
      }
    }
  }

  private renderTemplate(content: string): string {
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, this.variables.projectName)
      .replace(/\{\{PROJECT_SLUG\}\}/g, this.variables.projectSlug)
      .replace(/\{\{TEAM_NAME\}\}/g, this.variables.teamName)
      .replace(/\{\{DESCRIPTION\}\}/g, this.variables.description || '')
      .replace(/\{\{NODE_VERSION\}\}/g, this.variables.nodeVersion || '20')
      .replace(/\{\{NANOID\}\}/g, nanoid(8));
  }

  generateK8sManifests(): string {
    const { projectSlug } = this.variables;

    return `
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectSlug}-development
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectSlug}-staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectSlug}-production
`;
  }

  generateKustomizationYaml(env: 'development' | 'staging' | 'production'): string {
    const { projectSlug } = this.variables;
    const envUpper = env.charAt(0).toUpperCase() + env.slice(1);

    return `
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: ${projectSlug}-${env}
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: ${projectSlug}
  path: ./k8s/overlays/${env}
  prune: true
  targetNamespace: ${projectSlug}-${env}
`;
  }

  generateGitRepositoryYaml(gitUrl: string, branch: string = 'main'): string {
    const { projectSlug } = this.variables;

    return `
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: ${projectSlug}
  namespace: flux-system
spec:
  url: ${gitUrl}
  ref:
    branch: ${branch}
  interval: 1m
`;
  }
}

export async function loadTemplate(templateId: string) {
  const templatePath = join(TEMPLATES_DIR, templateId);

  if (!existsSync(templatePath)) {
    throw new Error(`Template ${templateId} not found at ${templatePath}`);
  }

  const packageJsonPath = join(templatePath, 'package.json');
  let packageJson: Record<string, unknown> = {};

  if (existsSync(packageJsonPath)) {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  }

  return {
    id: templateId,
    name: (packageJson.name as string) || templateId,
    version: (packageJson.version as string) || '1.0.0',
    description: (packageJson.description as string) || '',
  };
}

export function listTemplates(): Array<{ id: string; name: string }> {
  if (!existsSync(TEMPLATES_DIR)) {
    return [
      { id: 'nextjs', name: 'Next.js' },
      { id: 'express', name: 'Express.js' },
      { id: 'blank', name: 'Blank' },
    ];
  }

  const dirs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ id: d.name, name: d.name }));

  return dirs.length > 0
    ? dirs
    : [
        { id: 'nextjs', name: 'Next.js' },
        { id: 'express', name: 'Express.js' },
        { id: 'blank', name: 'Blank' },
      ];
}
