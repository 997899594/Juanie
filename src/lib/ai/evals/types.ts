export interface JuanieEvalFixture<TInput = unknown, TOutput = unknown> {
  id: string;
  promptKey: string;
  promptVersion: string;
  pluginId: string;
  skillId: string;
  scope: 'environment' | 'release';
  scenario: string;
  inputSummary: string;
  input: TInput;
  output: TOutput;
  assertions: string[];
}
