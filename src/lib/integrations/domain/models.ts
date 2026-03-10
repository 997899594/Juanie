export const CAPABILITIES = [
  'read_repo',
  'write_repo',
  'write_workflow',
  'manage_webhook',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
