export interface ServiceRuntimeCommandSpec {
  command: string[];
  args: string[];
  displayCommand: string;
}

export function buildServiceRuntimeCommandSpec(service: {
  name: string;
  startCommand?: string | null;
}): ServiceRuntimeCommandSpec {
  const displayCommand = service.startCommand?.trim();

  if (!displayCommand) {
    throw new Error(`Service ${service.name} is missing run.command in juanie.yml`);
  }

  return {
    command: ['sh', '-lc'],
    args: [displayCommand],
    displayCommand,
  };
}
