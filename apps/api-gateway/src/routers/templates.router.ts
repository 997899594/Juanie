import { cicdConfigSchema, dockerfileConfigSchema } from '@juanie/core-types'
import { TemplatesService } from '@juanie/service-templates'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

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

  get router() {
    return this.trpc.router({
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
        let preset: any
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
}
