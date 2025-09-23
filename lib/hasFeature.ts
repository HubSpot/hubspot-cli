import { http } from '@hubspot/local-dev-lib/http';
import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';
import { FEATURES } from './constants.js';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';

const FEATURES_THAT_DEFAULT_ON: string[] = [FEATURES.APPS_HOME];

export async function hasFeature(
  accountId: number,
  feature: ValueOf<typeof FEATURES>
): Promise<boolean> {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  if (
    enabledFeatures[feature] === undefined &&
    FEATURES_THAT_DEFAULT_ON.includes(feature)
  ) {
    return true;
  }

  return Boolean(enabledFeatures[feature]);
}

export async function hasUnfiedAppsAccess(accountId: number): Promise<boolean> {
  const response = await http.get<boolean>(accountId, {
    url: 'developer-tooling/external/developer-portal/has-unified-dev-platform-access',
  });

  return Boolean(response.data);
}
