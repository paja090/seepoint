export function canReuseResendDomain(existingId: string, ownedProviderDomainId: string | undefined, explicitlyAuthenticatedProvider: boolean) {
  return existingId === ownedProviderDomainId || explicitlyAuthenticatedProvider;
}
