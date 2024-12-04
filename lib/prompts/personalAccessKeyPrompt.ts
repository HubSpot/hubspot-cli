import open from 'open';
import {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} from '@hubspot/local-dev-lib/constants/auth';
import { deleteEmptyConfigFile } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser } from './promptUtils';
import { getCliAccountNamePromptConfig } from './accountNamePrompt';
import { i18n } from '../lang';
import { uiInfoSection } from '../ui';
import { EXIT_CODES } from '../enums/exitCodes';
import { PromptConfig } from '../../types/prompts';

const i18nKey = 'lib.prompts.personalAccessKeyPrompt';

type PersonalAccessKeyPromptResponse = {
  personalAccessKey: string;
  env: string;
};

type AccountIdPromptResponse = {
  accountId: number;
};

type ClientIdPromptResponse = {
  clientId: string;
};

type ClientSecretPromptResponse = {
  clientSecret: string;
};

type PersonalAcessKeyBrowserOpenPrepResponse = {
  personalAcessKeyBrowserOpenPrep: boolean;
};

type ScopesPromptResponse = {
  scopes: string;
};

/**
 * Displays notification to user that we are about to open the browser,
 * then opens their browser to the personal-access-key shortlink
 */
export async function personalAccessKeyPrompt({
  env,
  account,
}: {
  env: string;
  account?: string;
}): Promise<PersonalAccessKeyPromptResponse> {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  let url = `${websiteOrigin}/l/personal-access-key`;
  if (process.env.BROWSER !== 'none') {
    uiInfoSection(i18n(`${i18nKey}.personalAccessKeySetupTitle`), () => {
      logger.log(i18n(`${i18nKey}.personalAccessKeyBrowserOpenPrep`));
    });
    if (account) {
      url = `${websiteOrigin}/personal-access-key/${account}`;
    }
    const { personalAcessKeyBrowserOpenPrep: shouldOpen } = await promptUser([
      PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP,
    ]);
    if (shouldOpen) {
      open(url, { url: true });
    } else {
      deleteEmptyConfigFile();
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  logger.log(i18n(`${i18nKey}.logs.openingWebBrowser`, { url }));
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    env,
  };
}

export const ACCOUNT_ID: PromptConfig<AccountIdPromptResponse> = {
  name: 'accountId',
  message: i18n(`${i18nKey}.enterAccountId`),
  type: 'number',
  validate(val?: number) {
    if (!Number.isNaN(val) && val !== undefined && val > 0) {
      return true;
    }
    return i18n(`${i18nKey}.errors.invalidAccountId`);
  },
};

export const CLIENT_ID: PromptConfig<ClientIdPromptResponse> = {
  name: 'clientId',
  message: i18n(`${i18nKey}.enterClientId`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidOauthClientId`);
    } else if (val.length !== 36) {
      return i18n(`${i18nKey}.errors.invalidOauthClientIdLength`);
    }
    return true;
  },
};

export const CLIENT_SECRET: PromptConfig<ClientSecretPromptResponse> = {
  name: 'clientSecret',
  message: i18n(`${i18nKey}.enterClientSecret`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecret`);
    } else if (val.length !== 36) {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecretLength`);
    } else if (val[0] === '*') {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecretCopy`);
    }
    return true;
  },
};

export const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP: PromptConfig<PersonalAcessKeyBrowserOpenPrepResponse> = {
  name: 'personalAcessKeyBrowserOpenPrep',
  type: 'confirm',
  message: i18n(`${i18nKey}.personalAccessKeyBrowserOpenPrompt`),
};

export const PERSONAL_ACCESS_KEY: PromptConfig<PersonalAccessKeyPromptResponse> = {
  name: 'personalAccessKey',
  message: i18n(`${i18nKey}.enterPersonalAccessKey`),
  transformer: (val?: string) => {
    if (!val) return val;
    let res = '';
    for (let i = 0; i < val.length; i++) {
      res += '*';
    }
    return res;
  },
  validate(val?: string) {
    if (!val || typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidPersonalAccessKey`);
    } else if (val[0] === '•') {
      return i18n(`${i18nKey}.errors.invalidPersonalAccessKeyCopy`);
    }
    return true;
  },
};

export const SCOPES: PromptConfig<ScopesPromptResponse> = {
  type: 'checkbox',
  name: 'scopes',
  message: i18n(`${i18nKey}.selectScopes`),
  default: [...DEFAULT_OAUTH_SCOPES],
  choices: [...OAUTH_SCOPES],
};

// TODO: Type needed?
export const OAUTH_FLOW = [
  getCliAccountNamePromptConfig(),
  ACCOUNT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SCOPES,
];
