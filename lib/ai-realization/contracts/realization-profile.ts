export type OrganizationRealizationProfile = {
  organizationId: string;
  requiredGraphicsApproval: boolean;
  requiredPhotoDocumentation: boolean;
  requiredFinalReview: boolean;
  billingRequiresPhotos: boolean;
  deadlineWarningDays: number;
  productionLeadDays: number;
  installationLeadDays: number;
  automaticTaskGeneration: boolean;
};

export const DEFAULT_REALIZATION_PROFILE: Omit<OrganizationRealizationProfile, 'organizationId'> = {
  requiredGraphicsApproval: true,
  requiredPhotoDocumentation: true,
  requiredFinalReview: true,
  billingRequiresPhotos: true,
  deadlineWarningDays: 5,
  productionLeadDays: 3,
  installationLeadDays: 2,
  automaticTaskGeneration: true,
};
