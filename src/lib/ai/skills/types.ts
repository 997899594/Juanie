export interface JuanieSkillDefinition {
  id: string;
  title: string;
  description: string;
  scope: 'team' | 'project' | 'environment' | 'release';
  pluginIds: string[];
  toolIds: string[];
  contextProviderIds: string[];
  promptKey?: string | null;
  assetPath?: string;
  outputSchema?: string | null;
}
