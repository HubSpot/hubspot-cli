import type { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import type { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/translate';

import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
  APP_INSTALLATION_STATES,
} from '../constants.js';
import { isDeveloperTestAccount, isSandbox } from '../accountTypes.js';
import { isAppIRNode } from '../projects/structure.js';
import type {
  AppInstallationState,
  AppIRNode,
} from '../../types/ProjectComponents.js';

export type ScopeGroup = {
  id: number;
  name: string;
};

type CanUseStaticAuthTestAccountInstallOptions = {
  accountConfig?: HubSpotConfigAccount;
  appNode?: AppIRNode | null;
  parentAccountId?: number;
};

export function getAppNodeFromProjectNodes(projectNodes: {
  [key: string]: IntermediateRepresentationNodeLocalDev;
}): AppIRNode | null {
  return Object.values(projectNodes).find(isAppIRNode) || null;
}

export function isStaticAuthApp(appNode?: AppIRNode | null): boolean {
  return appNode?.config.auth.type.toLowerCase() === APP_AUTH_TYPES.STATIC;
}

export function isOAuthApp(appNode?: AppIRNode | null): boolean {
  return appNode?.config.auth.type.toLowerCase() === APP_AUTH_TYPES.OAUTH;
}

export function isPrivateApp(appNode?: AppIRNode | null): boolean {
  return (
    appNode?.config.distribution?.toLowerCase() ===
    APP_DISTRIBUTION_TYPES.PRIVATE
  );
}

export function isMarketplaceApp(appNode?: AppIRNode | null): boolean {
  return (
    appNode?.config.distribution?.toLowerCase() ===
    APP_DISTRIBUTION_TYPES.MARKETPLACE
  );
}

export function getAppInstallationState(
  isInstalledWithScopeGroups: boolean,
  previouslyAuthorizedScopeGroups: ScopeGroup[]
): AppInstallationState {
  if (isInstalledWithScopeGroups) {
    return APP_INSTALLATION_STATES.INSTALLED;
  }

  if (previouslyAuthorizedScopeGroups.length > 0) {
    return APP_INSTALLATION_STATES.INSTALLED_WITH_OUTDATED_SCOPES;
  }

  return APP_INSTALLATION_STATES.NOT_INSTALLED;
}

export function canUseStaticAuthTestAccountInstall({
  accountConfig,
  appNode,
  parentAccountId,
}: CanUseStaticAuthTestAccountInstallOptions): boolean {
  if (!accountConfig || !isStaticAuthApp(appNode)) {
    return false;
  }

  const accountCanUseTestInstall =
    isDeveloperTestAccount(accountConfig) || isSandbox(accountConfig);

  if (!accountCanUseTestInstall) {
    return false;
  }

  if (parentAccountId === undefined) {
    return true;
  }

  return accountConfig.parentAccountId === parentAccountId;
}
