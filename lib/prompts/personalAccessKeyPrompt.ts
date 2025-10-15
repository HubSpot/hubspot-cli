import open from 'open';
import {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} from '@hubspot/local-dev-lib/constants/auth';
import { deleteEmptyConfigFile } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { uiLogger } from '../ui/logger.js';
import { promptUser } from './promptUtils.js';
import {
  AccountNamePromptResponse,
  getCliAccountNamePromptConfig,
} from './accountNamePrompt.js';
import { uiInfoSection } from '../ui/index.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { PromptConfig } from '../../types/Prompts.js';
import { lib } from '../../lang/en.js';

export type PersonalAccessKeyPromptResponse = {
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

type PersonalAccessKeyBrowserOpenPrepResponse = {
  personalAccessKeyBrowserOpenPrep: string;
};

type ScopesPromptResponse = {
  scopes: string[];
};

export type OauthPromptResponse = AccountNamePromptResponse &
  AccountIdPromptResponse &
  ClientIdPromptResponse &
  ClientSecretPromptResponse &
  ScopesPromptResponse;

/**
 * Displays notification to user that we are about to open the browser,
 * then opens their browser to the personal-access-key shortlink
 */
export async function personalAccessKeyPrompt({
  env,
  account,
}: {
  env: string;
  account?: number;
}): Promise<PersonalAccessKeyPromptResponse> {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  let url = `${websiteOrigin}/l/personal-access-key`;
  if (process.env.BROWSER !== 'none') {
    uiInfoSection(
      lib.prompts.personalAccessKeyPrompt.personalAccessKeySetupTitle,
      () => {
        uiLogger.log(
          lib.prompts.personalAccessKeyPrompt.personalAccessKeyBrowserOpenPrep
        );
      }
    );
    if (account) {
      url = `${websiteOrigin}/personal-access-key/${account}`;
    }
    const { personalAccessKeyBrowserOpenPrep: choice } =
      await promptUser<PersonalAccessKeyBrowserOpenPrepResponse>([
        PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP,
      ]);

    if (!choice) {
      deleteEmptyConfigFile();
      process.exit(EXIT_CODES.SUCCESS);
    }

    if (
      choice ===
      lib.prompts.personalAccessKeyPrompt.personalAccessKeyPromptChoices
        .OPEN_BROWSER
    ) {
      open(url, { url: true });
      uiLogger.log(
        lib.prompts.personalAccessKeyPrompt.logs.openingWebBrowser(url)
      );
    }
  }

  const { personalAccessKey } =
    await promptUser<PersonalAccessKeyPromptResponse>(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    env,
  };
}

const ACCOUNT_ID: PromptConfig<AccountIdPromptResponse> = {
  name: 'accountId',
  message: lib.prompts.personalAccessKeyPrompt.enterAccountId,
  type: 'number',
  validate(val?: number) {
    if (!Number.isNaN(val) && val !== undefined && val > 0) {
      return true;
    }
    return lib.prompts.personalAccessKeyPrompt.errors.invalidAccountId;
  },
};

const CLIENT_ID: PromptConfig<ClientIdPromptResponse> = {
  name: 'clientId',
  message: lib.prompts.personalAccessKeyPrompt.enterClientId,
  validate(val?: string) {
    if (typeof val !== 'string') {
      return lib.prompts.personalAccessKeyPrompt.errors.invalidOauthClientId;
    } else if (val.length !== 36) {
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidOauthClientIdLength;
    }
    return true;
  },
};

const CLIENT_SECRET: PromptConfig<ClientSecretPromptResponse> = {
  name: 'clientSecret',
  message: lib.prompts.personalAccessKeyPrompt.enterClientSecret,
  validate(val?: string) {
    if (typeof val !== 'string') {
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidOauthClientSecret;
    } else if (val.length !== 36) {
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidOauthClientSecretLength;
    } else if (val[0] === '*') {
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidOauthClientSecretCopy;
    }
    return true;
  },
};

const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP: PromptConfig<PersonalAccessKeyBrowserOpenPrepResponse> =
  {
    name: 'personalAccessKeyBrowserOpenPrep',
    type: 'list',
    message: 'Choose your preferred method of authentication',
    choices: Object.values(
      lib.prompts.personalAccessKeyPrompt.personalAccessKeyPromptChoices
    ),
    default:
      lib.prompts.personalAccessKeyPrompt.personalAccessKeyPromptChoices
        .OPEN_BROWSER,
  };

const PERSONAL_ACCESS_KEY: PromptConfig<PersonalAccessKeyPromptResponse> = {
  name: 'personalAccessKey',
  message: lib.prompts.personalAccessKeyPrompt.enterPersonalAccessKey,
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
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidPersonalAccessKey;
    } else if (val[0] === '•') {
      return lib.prompts.personalAccessKeyPrompt.errors
        .invalidPersonalAccessKeyCopy;
    }
    return true;
  },
};

const SCOPES: PromptConfig<ScopesPromptResponse> = {
  type: 'checkbox',
  name: 'scopes',
  message: lib.prompts.personalAccessKeyPrompt.selectScopes,
  default: [...DEFAULT_OAUTH_SCOPES],
  choices: [...OAUTH_SCOPES],
};

export const OAUTH_FLOW = [
  getCliAccountNamePromptConfig(),
  ACCOUNT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SCOPES,
];
