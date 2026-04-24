export interface JuanieSkillDefinition {
  id: string;
  title: string;
  description: string;
  scope: 'team' | 'project' | 'environment' | 'release';
  executionMode?: 'structured' | 'chat' | 'hybrid';
  surfaces?: Array<'copilot-panel' | 'inline-card' | 'action-center' | 'task-center'>;
  pluginIds: string[];
  toolIds: string[];
  contextProviderIds: string[];
  references?: string[];
  examples?: string[];
  evals?: string[];
  packagePath?: string;
  promptKey?: string | null;
  assetPath?: string;
  outputSchema?: string | null;
}
