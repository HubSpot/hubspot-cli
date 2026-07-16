import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import type { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import type { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/translate';

import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
  APP_INSTALLATION_STATES,
} from '../../constants.js';
import type { AppIRNode } from '../../../types/ProjectComponents.js';
import {
  canUseStaticAuthTestAccountInstall,
  getAppInstallationState,
  getAppNodeFromProjectNodes,
  isMarketplaceApp,
  isOAuthApp,
  isPrivateApp,
  isStaticAuthApp,
} from '../install.js';

const staticPrivateAppNode = {
  uid: 'app-uid',
  componentType: 'APPLICATION',
  config: {
    name: 'My app',
    description: 'Test app',
    logo: 'logo.png',
    distribution: APP_DISTRIBUTION_TYPES.PRIVATE,
    auth: {
      type: APP_AUTH_TYPES.STATIC,
      redirectUrls: [],
      requiredScopes: [],
      optionalScopes: [],
      conditionallyRequiredScopes: [],
    },
  },
} as unknown as AppIRNode;

function account(
  accountType: HubSpotConfigAccount['accountType'],
  parentAccountId?: number
): HubSpotConfigAccount {
  return {
    accountId: 123,
    name: 'Test account',
    accountType,
    parentAccountId,
    env: 'prod',
    authType: 'personalaccesskey',
    personalAccessKey: 'personal-access-key',
    auth: {
      tokenInfo: {},
    },
  } as HubSpotConfigAccount;
}

describe('lib/app/install', () => {
  describe('getAppNodeFromProjectNodes()', () => {
    it('returns the app node when one exists', () => {
      const projectNodes = {
        [staticPrivateAppNode.uid]: staticPrivateAppNode,
      } as unknown as { [key: string]: IntermediateRepresentationNodeLocalDev };

      expect(getAppNodeFromProjectNodes(projectNodes)).toBe(
        staticPrivateAppNode
      );
    });

    it('returns null when no app node exists', () => {
      expect(getAppNodeFromProjectNodes({})).toBeNull();
    });
  });

  describe('app predicates', () => {
    it('identifies static auth private apps', () => {
      expect(isStaticAuthApp(staticPrivateAppNode)).toBe(true);
      expect(isPrivateApp(staticPrivateAppNode)).toBe(true);
    });

    it('identifies OAuth and marketplace apps', () => {
      const oauthMarketplaceAppNode = {
        ...staticPrivateAppNode,
        config: {
          ...staticPrivateAppNode.config,
          distribution: APP_DISTRIBUTION_TYPES.MARKETPLACE,
          auth: {
            ...staticPrivateAppNode.config.auth,
            type: APP_AUTH_TYPES.OAUTH,
          },
        },
      };

      expect(isOAuthApp(oauthMarketplaceAppNode)).toBe(true);
      expect(isMarketplaceApp(oauthMarketplaceAppNode)).toBe(true);
    });
  });

  describe('getAppInstallationState()', () => {
    it('returns installed when the current scope groups are installed', () => {
      expect(getAppInstallationState(true, [])).toBe(
        APP_INSTALLATION_STATES.INSTALLED
      );
    });

    it('returns outdated scopes when prior scope groups exist', () => {
      expect(
        getAppInstallationState(false, [{ id: 1, name: 'contacts.read' }])
      ).toBe(APP_INSTALLATION_STATES.INSTALLED_WITH_OUTDATED_SCOPES);
    });

    it('returns not installed when no prior installation exists', () => {
      expect(getAppInstallationState(false, [])).toBe(
        APP_INSTALLATION_STATES.NOT_INSTALLED
      );
    });
  });

  describe('canUseStaticAuthTestAccountInstall()', () => {
    it('allows static-auth app installs on developer test accounts', () => {
      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST),
          appNode: staticPrivateAppNode,
        })
      ).toBe(true);
    });

    it('allows static-auth app installs on sandboxes', () => {
      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX),
          appNode: staticPrivateAppNode,
        })
      ).toBe(true);
    });

    it('requires the expected parent account when provided', () => {
      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST, 456),
          appNode: staticPrivateAppNode,
          parentAccountId: 456,
        })
      ).toBe(true);

      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST, 456),
          appNode: staticPrivateAppNode,
          parentAccountId: 789,
        })
      ).toBe(false);
    });

    it('rejects standard accounts, missing account config, and OAuth apps', () => {
      const oauthAppNode = {
        ...staticPrivateAppNode,
        config: {
          ...staticPrivateAppNode.config,
          auth: {
            ...staticPrivateAppNode.config.auth,
            type: APP_AUTH_TYPES.OAUTH,
          },
        },
      };

      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.STANDARD),
          appNode: staticPrivateAppNode,
        })
      ).toBe(false);
      expect(
        canUseStaticAuthTestAccountInstall({
          appNode: staticPrivateAppNode,
        })
      ).toBe(false);
      expect(
        canUseStaticAuthTestAccountInstall({
          accountConfig: account(HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST),
          appNode: oauthAppNode,
        })
      ).toBe(false);
    });
  });
});
