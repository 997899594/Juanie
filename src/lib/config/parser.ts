import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['web', 'worker', 'cron']),

  build: z
    .object({
      command: z.string().optional(),
      dockerfile: z.string().optional(),
      context: z.string().optional(),
    })
    .optional(),

  run: z.object({
    command: z.string(),
    port: z.number().int().min(1).max(65535).optional(),
  }),

  healthcheck: z
    .object({
      path: z.string().optional(),
      interval: z.number().int().min(5).max(300).optional(),
    })
    .optional(),

  env: z.record(z.string(), z.string()).optional(),

  scaling: z
    .object({
      min: z.number().int().min(0).max(100).optional(),
      max: z.number().int().min(1).max(1000).optional(),
      cpu: z.number().int().min(1).max(100).optional(),
    })
    .optional(),

  schedule: z.string().optional(),

  domain: z.string().optional(),
  isPublic: z.boolean().optional(),

  resources: z
    .object({
      cpuRequest: z.string().optional(),
      cpuLimit: z.string().optional(),
      memoryRequest: z.string().optional(),
      memoryLimit: z.string().optional(),
    })
    .optional(),
});

export const databaseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['postgresql', 'mysql', 'redis', 'mongodb']),
  plan: z.enum(['starter', 'standard', 'premium']).optional(),
});

export const environmentSchema = z.object({
  branch: z.string().optional(),
  domain: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

export const juanieConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  framework: z.string().optional(),

  services: z.array(serviceSchema).min(1).max(20),
  databases: z.array(databaseSchema).max(10).optional(),
  environments: z.record(z.string(), environmentSchema).optional(),

  env: z.record(z.string(), z.string()).optional(),
});

export type ServiceConfig = z.infer<typeof serviceSchema>;
export type DatabaseConfig = z.infer<typeof databaseSchema>;
export type EnvironmentConfig = z.infer<typeof environmentSchema>;
export type JuanieConfig = z.infer<typeof juanieConfigSchema>;

export interface ParsedConfig extends JuanieConfig {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function parseJuanieConfig(yamlContent: string): ParsedConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  let rawConfig: Record<string, unknown>;

  try {
    const { parse } = require('yaml');
    rawConfig = parse(yamlContent);
  } catch (e) {
    return {
      isValid: false,
      errors: [`Failed to parse YAML: ${e instanceof Error ? e.message : 'Unknown error'}`],
      warnings: [],
      services: [],
    };
  }

  const result = juanieConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const formattedErrors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return {
      isValid: false,
      errors: formattedErrors,
      warnings: [],
      services: [],
    };
  }

  const config = result.data;

  if (config.services.some((s) => s.type === 'cron' && !s.schedule)) {
    warnings.push('Cron services should have a schedule defined');
  }

  if (config.services.some((s) => s.type === 'web' && !s.run.port)) {
    warnings.push('Web services should have a port defined');
  }

  return {
    ...config,
    isValid: true,
    errors,
    warnings,
  };
}

export function generateDefaultConfig(
  name: string,
  framework: string,
  options?: {
    hasWorker?: boolean;
    database?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  }
): string {
  const lines: string[] = [
    `# juanie.yaml`,
    `name: ${name}`,
    `framework: ${framework}`,
    ``,
    `services:`,
    `  - name: web`,
    `    type: web`,
    `    build:`,
    `      command: npm run build`,
    `    run:`,
    `      command: npm start`,
    `      port: 3000`,
    `    healthcheck:`,
    `      path: /api/health`,
    `    domain: ${name}.juanie.dev`,
  ];

  if (options?.hasWorker) {
    lines.push(
      ``,
      `  - name: worker`,
      `    type: worker`,
      `    run:`,
      `      command: npm run worker`,
      `    scaling:`,
      `      min: 1`,
      `      max: 5`
    );
  }

  if (options?.database) {
    lines.push(
      ``,
      `databases:`,
      `  - name: ${options.database}`,
      `    type: ${options.database}`,
      `    plan: starter`
    );
  }

  lines.push(
    ``,
    `environments:`,
    `  production:`,
    `    branch: main`,
    `    domain: ${name}.juanie.dev`,
    `  staging:`,
    `    branch: develop`,
    ``,
    `# Environment variables are configured in the dashboard`,
    `# Do not commit secrets to the repository`
  );

  return lines.join('\n');
}

export const FRAMEWORK_PRESETS: Record<
  string,
  {
    buildCommand: string;
    startCommand: string;
    port: number;
    healthcheckPath: string;
  }
> = {
  nextjs: {
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    healthcheckPath: '/api/health',
  },
  react: {
    buildCommand: 'npm run build',
    startCommand: 'npm run preview',
    port: 4173,
    healthcheckPath: '/',
  },
  express: {
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    healthcheckPath: '/health',
  },
  fastapi: {
    buildCommand: '',
    startCommand: 'uvicorn main:app --host 0.0.0.0 --port 3000',
    port: 3000,
    healthcheckPath: '/health',
  },
  go: {
    buildCommand: 'go build -o app .',
    startCommand: './app',
    port: 3000,
    healthcheckPath: '/health',
  },
};
