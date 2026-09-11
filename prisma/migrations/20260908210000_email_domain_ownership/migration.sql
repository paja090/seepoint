-- Fail safely on pre-existing duplicate claims: reconcile ownership before retrying.
-- Never remove or silently reassign another organization's domain configuration.
CREATE UNIQUE INDEX "OrganizationEmailSettings_domain_key" ON "OrganizationEmailSettings"("domain");
CREATE UNIQUE INDEX "OrganizationEmailSettings_providerDomainId_key" ON "OrganizationEmailSettings"("providerDomainId");
