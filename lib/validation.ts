import * as fs from 'fs';
import * as path from 'path';
import { Arguments } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { CMS_PUBLISH_MODE } from '@hubspot/local-dev-lib/constants/files';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { commaSeparatedValues } from '@hubspot/local-dev-lib/text';
import {
  getConfigPath,
  getAccountConfig,
  getAccountId,
  loadConfigFromEnvironment,
} from '@hubspot/local-dev-lib/config';
import { getOauthManager } from '@hubspot/local-dev-lib/oauth';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import {
  getAbsoluteFilePath,
  getCwd,
  getExt,
} from '@hubspot/local-dev-lib/path';

import { getCmsPublishMode } from './commonOpts';
import { logError } from './errorHandlers/index';

export async function validateAccount(
  options: Arguments<{
    account?: string;
    accountId?: string;
    derivedAccountId?: number;
    providedAccountId?: string;
  }>
): Promise<boolean> {
  const { derivedAccountId, providedAccountId } = options;
  const accountId = getAccountId(derivedAccountId);

  if (!accountId) {
    if (providedAccountId) {
      logger.error(
        `The account "${providedAccountId}" could not be found in the config`
      );
    } else {
      logger.error(
        'An account needs to be supplied either via "--account" or through setting a "defaultPortal"'
      );
    }
    return false;
  }

  if (providedAccountId && loadConfigFromEnvironment()) {
    throw new Error(
      'Cannot specify an account when environment variables are supplied. Please unset the environment variables or do not use the "--account" flag.'
    );
  }

  const accountConfig = getAccountConfig(accountId);
  if (!accountConfig) {
    logger.error(`The account ${accountId} has not been configured`);
    return false;
  }

  const { authType, auth, apiKey, personalAccessKey } = accountConfig;

  if (typeof authType === 'string' && authType !== authType.toLowerCase()) {
    logger.error(
      `Invalid "authType" value "${authType}" for account "${accountId}" in config file: ${getConfigPath()}. Valid values are ${commaSeparatedValues(
        [
          PERSONAL_ACCESS_KEY_AUTH_METHOD,
          OAUTH_AUTH_METHOD,
          API_KEY_AUTH_METHOD,
        ].map(method => method.value)
      )}.`
    );
  }

  if (authType === 'oauth2') {
    if (typeof auth !== 'object') {
      logger.error(
        `The OAuth2 auth configuration for account ${accountId} is missing`
      );
      return false;
    }

    const { clientId, clientSecret, tokenInfo } = auth;

    if (!clientId || !clientSecret || !tokenInfo || !tokenInfo.refreshToken) {
      logger.error(
        `The OAuth2 configuration for account ${accountId} is incorrect`
      );
      logger.error('Run "hs auth --type=oauth2" to reauthenticate');
      return false;
    }

    const oauth = getOauthManager(accountId, accountConfig);
    try {
      let accessToken: string | undefined;

      if (oauth) {
        accessToken = await oauth.accessToken();
      }
      if (!accessToken) {
        logger.error(
          `The OAuth2 access token could not be found for accountId ${accountId}`
        );
        return false;
      }
    } catch (e) {
      logError(e);
      return false;
    }
  } else if (authType === 'personalaccesskey') {
    if (!personalAccessKey) {
      logger.error(
        `The account "${accountId}" is configured to use a access key for authentication and is missing a "personalAccessKey" in the configuration file`
      );
      return false;
    }

    try {
      const accessToken = await accessTokenForPersonalAccessKey(accountId);
      if (!accessToken) {
        logger.error(
          `An OAuth2 access token for account "${accountId} could not be retrieved using the "personalAccessKey" provided`
        );
        return false;
      }
    } catch (e) {
      logError(e);
      return false;
    }
  } else if (!apiKey) {
    logger.error(
      `The accountId ${accountId} is missing authentication configuration`
    );
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
  const modesMessage = `Available CMS publish modes are: ${Object.values(
    CMS_PUBLISH_MODE
  ).join(', ')}.`;
  if (cmsPublishMode != null) {
    logger.error(
      [
        `The CMS publish mode "${cmsPublishMode}" is invalid.`,
        modesMessage,
      ].join(' ')
    );
  } else {
    logger.error(
      ['The CMS publish mode option is missing.', modesMessage].join(' ')
    );
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
    logger.error(`The path "${_path}" is not a path to a file`);
    return null;
  }

  if (getExt(_path) !== 'json') {
    logger.error(`The file "${_path}" must be a valid JSON file`);
    return null;
  }

  let result;

  try {
    result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    logger.error(`The file "${_path}" contains invalid JSON`);
    result = null;
  }

  return result;
}
