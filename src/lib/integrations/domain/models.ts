export const CAPABILITIES = ['read_repo', 'write_repo', 'write_workflow'] as const;

export type Capability = (typeof CAPABILITIES)[number];
