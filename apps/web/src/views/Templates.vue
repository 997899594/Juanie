<template>
  <PageContainer title="模板生成" description="快速生成 Dockerfile 和 CI/CD 配置文件">

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="dockerfile">
          <FileCode class="mr-2 h-4 w-4" />
          Dockerfile
        </TabsTrigger>
        <TabsTrigger value="cicd">
          <GitBranch class="mr-2 h-4 w-4" />
          CI/CD 配置
        </TabsTrigger>
      </TabsList>

      <!-- Dockerfile Tab -->
      <TabsContent value="dockerfile" class="space-y-4">
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Configuration Form -->
          <Card>
            <CardHeader>
              <CardTitle>配置参数</CardTitle>
              <CardDescription>填写 Dockerfile 生成参数</CardDescription>
            </CardHeader>
            <CardContent>
              <form @submit.prevent="handleGenerateDockerfile" class="space-y-4">
                <div class="space-y-2">
                  <Label for="runtime">运行时</Label>
                  <Select v-model="dockerfileForm.runtime">
                    <SelectTrigger id="runtime">
                      <SelectValue placeholder="选择运行时" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nodejs">Node.js</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="bun">Bun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label for="version">版本</Label>
                  <Input
                    id="version"
                    v-model="dockerfileForm.version"
                    placeholder="例如：20、3.11"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <Label for="workdir">工作目录</Label>
                  <Input
                    id="workdir"
                    v-model="dockerfileForm.workdir"
                    placeholder="/app"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <Label for="port">端口</Label>
                  <Input
                    id="port"
                    v-model.number="dockerfileForm.port"
                    type="number"
                    placeholder="3000"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <Label for="buildCommand">构建命令（可选）</Label>
                  <Input
                    id="buildCommand"
                    v-model="dockerfileForm.buildCommand"
                    placeholder="npm run build"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="startCommand">启动命令</Label>
                  <Input
                    id="startCommand"
                    v-model="dockerfileForm.startCommand"
                    placeholder="npm start"
                    required
                  />
                </div>

                <Button type="submit" class="w-full" :disabled="isGenerating">
                  <Loader2 v-if="isGenerating" class="mr-2 h-4 w-4 animate-spin" />
                  <Wand2 v-else class="mr-2 h-4 w-4" />
                  生成 Dockerfile
                </Button>
              </form>
            </CardContent>
          </Card>

          <!-- Preview -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>预览</CardTitle>
                  <CardDescription>生成的 Dockerfile</CardDescription>
                </div>
                <div class="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="!generatedTemplate"
                    @click="copyToClipboard"
                  >
                    <Copy class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="!generatedTemplate"
                    @click="downloadTemplate('Dockerfile')"
                  >
                    <Download class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                v-if="generatedTemplate && templateType === 'dockerfile'"
                class="relative"
              >
                <pre
                  class="p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono"
                ><code>{{ generatedTemplate }}</code></pre>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center h-64 text-center"
              >
                <FileCode class="h-12 w-12 text-muted-foreground mb-4" />
                <p class="text-muted-foreground">填写配置参数并生成 Dockerfile</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- CI/CD Tab -->
      <TabsContent value="cicd" class="space-y-4">
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Configuration Form -->
          <Card>
            <CardHeader>
              <CardTitle>配置参数</CardTitle>
              <CardDescription>填写 CI/CD 配置参数</CardDescription>
            </CardHeader>
            <CardContent>
              <form @submit.prevent="handleGenerateCICD" class="space-y-4">
                <div class="space-y-2">
                  <Label for="platform">CI/CD 平台</Label>
                  <Select v-model="cicdForm.platform">
                    <SelectTrigger id="platform">
                      <SelectValue placeholder="选择平台" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gitlab">GitLab CI</SelectItem>
                      <SelectItem value="github">GitHub Actions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label for="runtime-cicd">运行时</Label>
                  <Select v-model="cicdForm.runtime">
                    <SelectTrigger id="runtime-cicd">
                      <SelectValue placeholder="选择运行时" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nodejs">Node.js</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="bun">Bun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label for="stages">构建阶段</Label>
                  <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                      <Checkbox id="test" v-model:checked="cicdForm.stages.test" />
                      <Label for="test" class="font-normal">测试</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                      <Checkbox id="build" v-model:checked="cicdForm.stages.build" />
                      <Label for="build" class="font-normal">构建</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                      <Checkbox id="deploy" v-model:checked="cicdForm.stages.deploy" />
                      <Label for="deploy" class="font-normal">部署</Label>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <Label for="dockerRegistry">Docker 镜像仓库（可选）</Label>
                  <Input
                    id="dockerRegistry"
                    v-model="cicdForm.dockerRegistry"
                    placeholder="registry.example.com"
                  />
                </div>

                <Button type="submit" class="w-full" :disabled="isGenerating">
                  <Loader2 v-if="isGenerating" class="mr-2 h-4 w-4 animate-spin" />
                  <Wand2 v-else class="mr-2 h-4 w-4" />
                  生成 CI/CD 配置
                </Button>
              </form>
            </CardContent>
          </Card>

          <!-- Preview -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>预览</CardTitle>
                  <CardDescription>生成的 CI/CD 配置</CardDescription>
                </div>
                <div class="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="!generatedTemplate"
                    @click="copyToClipboard"
                  >
                    <Copy class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="!generatedTemplate"
                    @click="downloadTemplate('.gitlab-ci.yml')"
                  >
                    <Download class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="generatedTemplate && templateType === 'cicd'" class="relative">
                <pre
                  class="p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono"
                ><code>{{ generatedTemplate }}</code></pre>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center h-64 text-center"
              >
                <GitBranch class="h-12 w-12 text-muted-foreground mb-4" />
                <p class="text-muted-foreground">填写配置参数并生成 CI/CD 配置</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import { ref } from 'vue'
import { useTemplates } from '@/composables/useTemplates'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@juanie/ui'
import {
  FileCode,
  GitBranch,
  Wand2,
  Copy,
  Download,
  Loader2,
} from 'lucide-vue-next'

const {
  generatedTemplate,
  templateType,
  generateDockerfile,
  generateCICD,
  copyToClipboard,
  downloadTemplate,
  isGenerating,
} = useTemplates()

const activeTab = ref('dockerfile')

const dockerfileForm = ref({
  runtime: 'nodejs' as 'nodejs' | 'python' | 'bun',
  version: '20',
  workdir: '/app',
  port: 3000,
  buildCommand: '',
  startCommand: 'npm start',
})

const cicdForm = ref({
  platform: 'gitlab' as 'gitlab' | 'github',
  runtime: 'nodejs' as 'nodejs' | 'python' | 'bun',
  stages: {
    test: true,
    build: true,
    deploy: true,
  },
  dockerRegistry: '',
})

const handleGenerateDockerfile = () => {
  generateDockerfile(dockerfileForm.value)
}

const handleGenerateCICD = () => {
  const stages = Object.entries(cicdForm.value.stages)
    .filter(([_, enabled]) => enabled)
    .map(([stage]) => stage)

  generateCICD({
    platform: cicdForm.value.platform,
    runtime: cicdForm.value.runtime,
    stages,
    dockerRegistry: cicdForm.value.dockerRegistry || undefined,
  })
}
</script>
