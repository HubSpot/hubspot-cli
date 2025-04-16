import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';
import { logger } from '@hubspot/local-dev-lib/logger';

export async function hasFeature(
  accountId: number,
  feature: string
): Promise<boolean> {
  const {
    data: { enabledFeatures },
  } = await fetchEnabledFeatures(accountId);

  logger.debug(enabledFeatures);

  return Boolean(enabledFeatures[feature]);
}
