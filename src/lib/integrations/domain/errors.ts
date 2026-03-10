export type IntegrationErrorCode =
  | 'INTEGRATION_NOT_BOUND'
  | 'GRANT_EXPIRED'
  | 'GRANT_REVOKED'
  | 'MISSING_CAPABILITY'
  | 'PROVIDER_ACCESS_DENIED'
  | 'PROVIDER_RESOURCE_NOT_FOUND';

export type IntegrationError = {
  code: IntegrationErrorCode;
  message: string;
  capability?: string;
};

const createError = (
  code: IntegrationErrorCode,
  message: string,
  extras?: Pick<IntegrationError, 'capability'>
): IntegrationError => ({
  code,
  message,
  ...extras,
});

export const integrationErrors = {
  notBound: () => createError('INTEGRATION_NOT_BOUND', 'Integration is not bound'),
  grantExpired: () => createError('GRANT_EXPIRED', 'Integration grant is expired'),
  grantRevoked: () => createError('GRANT_REVOKED', 'Integration grant is revoked'),
  missingCapability: (capability: string) =>
    createError('MISSING_CAPABILITY', `MISSING_CAPABILITY(${capability})`, { capability }),
  providerAccessDenied: () =>
    createError('PROVIDER_ACCESS_DENIED', 'Provider denied access to this resource'),
  providerResourceNotFound: () =>
    createError('PROVIDER_RESOURCE_NOT_FOUND', 'Provider resource was not found'),
};
