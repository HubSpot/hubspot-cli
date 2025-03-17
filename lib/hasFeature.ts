import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';

export const UNIFIED_APPS_BETA = 'Developers:UnifiedApps:PrivateBeta';

export async function hasFeature(
  accountId: number,
  feature: string
): Promise<boolean> {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  return Boolean(enabledFeatures[feature]);
}

export async function hasUnifiedAppsAccess(
  accountId: number
): Promise<boolean> {
  return hasFeature(accountId, UNIFIED_APPS_BETA);
}
