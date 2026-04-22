export interface JuanieSkillDefinition {
  id: string;
  title: string;
  description: string;
  scope: 'team' | 'project' | 'environment' | 'release';
  pluginIds: string[];
  toolIds: string[];
  contextProviderIds: string[];
  outputSchema?: string | null;
}
