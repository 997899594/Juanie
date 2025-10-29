import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../../trpc/trpc.service'
import { TemplatesService } from './templates.service'

const dockerfileConfigSchema = z.object({
  runtime: z.enum(['nodejs', 'python', 'bun']),
  version: z.string(),
  port: z.number().int().positive(),
  packageManager: z.enum(['npm', 'yarn', 'pnpm']).optional(),
  hasBuildStep: z.boolean().optional(),
  buildCommand: z.string().optional(),
  buildOutput: z.string().optional(),
  startCommand: z.string(),
  healthCheck: z.boolean().optional(),
  healthCheckPath: z.string().optional(),
})

const cicdConfigSchema = z.object({
  platform: z.enum(['github', 'gitlab']),
  runtime: z.enum(['nodejs', 'python', 'bun']),
  version: z.string(),
  packageManager: z.string().optional(),
  installCommand: z.string(),
  hasLinter: z.boolean().optional(),
  lintCommand: z.string().optional(),
  hasTypeCheck: z.boolean().optional(),
  typeCheckCommand: z.string().optional(),
  hasTests: z.boolean().optional(),
  testCommand: z.string().optional(),
  hasCoverage: z.boolean().optional(),
  coverageFile: z.string().optional(),
  coverageRegex: z.string().optional(),
  testEnvVars: z.record(z.string()).optional(),
  services: z.array(z.string()).optional(),
  buildArgs: z.record(z.string()).optional(),
  deployBranch: z.string(),
  environment: z.string(),
  environmentUrl: z.string(),
  deployScript: z.string(),
  manualDeploy: z.boolean().optional(),
  registry: z.string().optional(),
  imageName: z.string().optional(),
})

const presetSchema = z.object({
  type: z.enum(['nodejs', 'python', 'bun']),
  framework: z.string().optional(),
})

@Injectable()
export class TemplatesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly templatesService: TemplatesService,
  ) {}

  router = this.trpc.router({
    generateDockerfile: this.trpc.protectedProcedure
      .input(dockerfileConfigSchema)
      .mutation(async ({ input }) => {
        const dockerfile = await this.templatesService.generateDockerfile(input)
        return { dockerfile }
      }),

    generateCICD: this.trpc.protectedProcedure
      .input(cicdConfigSchema)
      .mutation(async ({ input }) => {
        const cicd = await this.templatesService.generateCICD(input)
        return { cicd }
      }),

    getPreset: this.trpc.protectedProcedure.input(presetSchema).query(({ input }) => {
      let preset
      switch (input.type) {
        case 'nodejs':
          preset = this.templatesService.getNodeJSPreset(input.framework as any)
          break
        case 'python':
          preset = this.templatesService.getPythonPreset(input.framework as any)
          break
        case 'bun':
          preset = this.templatesService.getBunPreset()
          break
      }
      return { preset }
    }),
  })
}
