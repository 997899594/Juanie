import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { nanoid } from 'nanoid';

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
