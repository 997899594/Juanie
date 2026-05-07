export interface GatewayRouteConfig {
  name: string;
  namespace: string;
  apexSectionName: string;
  wildcardSectionName: string;
}

function readEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function getGatewayRouteConfig(): GatewayRouteConfig {
  return {
    name: readEnv('JUANIE_GATEWAY_NAME', 'shared-gateway'),
    namespace: readEnv('JUANIE_GATEWAY_NAMESPACE', 'juanie'),
    apexSectionName: readEnv('JUANIE_GATEWAY_APEX_SECTION_NAME', 'https-apex'),
    wildcardSectionName: readEnv('JUANIE_GATEWAY_WILDCARD_SECTION_NAME', 'https-wildcard'),
  };
}
