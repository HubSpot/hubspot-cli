import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';
import { FEATURES } from './constants';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';

export async function hasFeature(
  accountId: number,
  feature: ValueOf<typeof FEATURES>
): Promise<boolean> {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  return Boolean(enabledFeatures[feature]);
}
