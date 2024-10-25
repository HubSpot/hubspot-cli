import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';

export async function hasFeature(
  accountId: number,
  feature: string
): Promise<boolean> {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  return Boolean(enabledFeatures[feature]);
}
