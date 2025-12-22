import * as fs from 'fs';
import * as path from 'path';
import { Arguments } from 'yargs';
import { uiLogger } from '../lib/ui/logger.js';
import { CMS_PUBLISH_MODE } from '@hubspot/local-dev-lib/constants/files';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { commaSeparatedValues } from '@hubspot/local-dev-lib/text';
import {
  getConfigFilePath,
  getConfigAccountById,
} from '@hubspot/local-dev-lib/config';
import { getOauthManager } from '@hubspot/local-dev-lib/oauth';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import {
  getAbsoluteFilePath,
  getCwd,
  getExt,
} from '@hubspot/local-dev-lib/path';
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';

import { getCmsPublishMode } from './commonOpts.js';
import { logError } from './errorHandlers/index.js';
import { lib } from '../lang/en.js';

export async function validateAccount(
  options: Arguments<{
    account?: string;
    accountId?: string;
    derivedAccountId?: number;
    userProvidedAccount?: string;
  }>
): Promise<boolean> {
  const { derivedAccountId, userProvidedAccount } = options;
  const accountId = derivedAccountId;

  if (!accountId) {
    if (userProvidedAccount) {
      uiLogger.error(
        lib.validation.accountNotFoundInConfig(userProvidedAccount)
      );
    } else {
      uiLogger.error(lib.validation.accountRequired);
    }
    return false;
  }

  if (
    userProvidedAccount &&
    process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG]
  ) {
    throw new Error(lib.validation.userProvidedAccount);
  }

  const accountConfig = getConfigAccountById(accountId);
  if (!accountConfig) {
    uiLogger.error(lib.validation.accountNotConfigured(accountId));
    return false;
  }

  const { authType } = accountConfig;

  if (typeof authType === 'string' && authType !== authType.toLowerCase()) {
    uiLogger.error(
      lib.validation.invalidAuthType(
        authType,
        accountId,
        getConfigFilePath(),
        commaSeparatedValues(
          [
            PERSONAL_ACCESS_KEY_AUTH_METHOD,
            OAUTH_AUTH_METHOD,
            API_KEY_AUTH_METHOD,
          ].map(method => method.value)
        )
      )
    );
  }

  if (authType === 'oauth2') {
    if (typeof accountConfig.auth !== 'object') {
      uiLogger.error(lib.validation.oauth2ConfigMissing(accountId));
      return false;
    }

    const { clientId, clientSecret, tokenInfo } = accountConfig.auth;

    if (!clientId || !clientSecret || !tokenInfo || !tokenInfo.refreshToken) {
      uiLogger.error(lib.validation.oauth2ConfigIncorrect(accountId));
      return false;
    }

    const oauth = getOauthManager(accountConfig);
    try {
      let accessToken: string | undefined;

      if (oauth) {
        accessToken = await oauth.accessToken();
      }
      if (!accessToken) {
        uiLogger.error(lib.validation.oauth2AccessTokenNotFound(accountId));
        return false;
      }
    } catch (e) {
      logError(e);
      return false;
    }
  } else if (authType === 'personalaccesskey') {
    if (!accountConfig.personalAccessKey) {
      uiLogger.error(lib.validation.personalAccessKeyMissing(accountId));
      return false;
    }

    try {
      const accessToken = await accessTokenForPersonalAccessKey(accountId);
      if (!accessToken) {
        uiLogger.error(
          lib.validation.personalAccessKeyTokenRetrievalFailed(accountId)
        );
        return false;
      }
    } catch (e) {
      logError(e);
      return false;
    }
  } else if (!accountConfig.apiKey) {
    uiLogger.error(lib.validation.authConfigurationMissing(accountId));
    return false;
  }

  return true;
}

export function validateCmsPublishMode(
  options: Arguments<{ cmsPublishMode?: CmsPublishMode }>
): boolean {
  const cmsPublishMode = getCmsPublishMode(options);
  if (CMS_PUBLISH_MODE[cmsPublishMode]) {
    return true;
  }
  const modesMessage = lib.validation.availableCMSModes(
    Object.values(CMS_PUBLISH_MODE).join(', ')
  );
  if (cmsPublishMode != null) {
    uiLogger.error(
      lib.validation.invalidCmsPublishMode(cmsPublishMode, modesMessage)
    );
  } else {
    uiLogger.error(lib.validation.missingCmsPublishMode(modesMessage));
  }
  return false;
}

export function fileExists(_path: string): boolean {
  try {
    const absoluteSrcPath = path.resolve(getCwd(), _path);
    if (!absoluteSrcPath) return false;

    const stats = fs.statSync(absoluteSrcPath);
    const isFile = stats.isFile();

    if (!isFile) {
      return false;
    }
  } catch (e) {
    return false;
  }

  return true;
}

export function checkAndConvertToJson(_path: string): unknown | null {
  const filePath = getAbsoluteFilePath(_path);
  if (!fileExists(filePath)) {
    uiLogger.error(lib.validation.pathNotFile(_path));
    return null;
  }

  if (getExt(_path) !== 'json') {
    uiLogger.error(lib.validation.fileNotJson(_path));
    return null;
  }

  let result;

  try {
    result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    uiLogger.error(lib.validation.fileInvalidJson(_path));
    result = null;
  }

  return result;
}
