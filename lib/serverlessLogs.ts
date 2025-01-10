import https from 'https';
import chalk from 'chalk';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  isHubSpotHttpError,
  isMissingScopeError,
} from '@hubspot/local-dev-lib/errors/index';
import {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { fetchScopeData } from '@hubspot/local-dev-lib/api/localDevAuth';

import { outputLogs } from './ui/serverlessFunctionLogs';
import { logError, ApiErrorContext } from './errorHandlers/index';
import SpinniesManager from './ui/SpinniesManager';
import { handleExit, handleKeypress } from './process';
import { EXIT_CODES } from './enums/exitCodes';
import { i18n } from './lang';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import {
  FunctionLog,
  GetFunctionLogsResponse,
} from '@hubspot/local-dev-lib/types/Functions';

const TAIL_DELAY = 5000;

function base64EncodeString(valueToEncode: string): string {
  if (typeof valueToEncode !== 'string') {
    return valueToEncode;
  }

  const stringBuffer = Buffer.from(valueToEncode);
  return encodeURIComponent(stringBuffer.toString('base64'));
}

function handleUserInput(): void {
  const onTerminate = async () => {
    SpinniesManager.remove('tailLogs');
    SpinniesManager.remove('stopMessage');
    process.exit(EXIT_CODES.SUCCESS);
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name == 'c') || key.name === 'q') {
      onTerminate();
    }
  });
}

async function verifyAccessKeyAndUserAccess(
  accountId: number,
  scopeGroup: string
): Promise<void> {
  const accountConfig = getAccountConfig(accountId);

  if (!accountConfig) {
    return;
  }

  // TODO[JOE]: Update this i18n key
  const i18nKey = 'lib.serverless';
  const { authType } = accountConfig;
  if (authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return;
  }

  let scopesData;
  try {
    const resp = await fetchScopeData(accountId, scopeGroup);
    scopesData = resp.data;
  } catch (e) {
    logger.debug(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.fetchScopeDataError`, {
        scopeGroup,
      })
    );
    logger.debug(e);
    return;
  }
  const { portalScopesInGroup, userScopesInGroup } = scopesData;

  if (!portalScopesInGroup.length) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.portalMissingScope`)
    );
    return;
  }

  if (!portalScopesInGroup.every(s => userScopesInGroup.includes(s))) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.userMissingScope`)
    );
  } else {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.genericMissingScope`)
    );
  }
}

export async function tailLogs(
  accountId: number,
  name: string,
  fetchLatest: () => HubSpotPromise<FunctionLog>,
  tailCall: (after: string) => HubSpotPromise<GetFunctionLogsResponse>,
  compact = false
): Promise<void> {
  let initialAfter = '';

  try {
    const { data: latestLog } = await fetchLatest();
    initialAfter = latestLog && base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (isHubSpotHttpError(e) && e.status !== 404) {
      if (isMissingScopeError(e)) {
        await verifyAccessKeyAndUserAccess(
          accountId,
          SCOPE_GROUPS.CMS_FUNCTIONS
        );
      } else {
        await logError(e, new ApiErrorContext({ accountId }));
      }
    }
  }

  async function tail(after: string): Promise<void> {
    let latestLog: GetFunctionLogsResponse;
    let nextAfter: string;
    try {
      const { data } = await tailCall(after);
      latestLog = data;
      nextAfter = latestLog.paging.next.after;
    } catch (e) {
      if (isHubSpotHttpError(e) && e.status !== 404) {
        logError(
          e,
          new ApiErrorContext({
            accountId,
          })
        );
      }
      process.exit(EXIT_CODES.SUCCESS);
    }

    if (latestLog && latestLog.results.length) {
      outputLogs(latestLog, {
        compact,
      });
    }

    setTimeout(async () => {
      await tail(nextAfter);
    }, TAIL_DELAY);
  }

  SpinniesManager.init();

  SpinniesManager.add('tailLogs', {
    text: `Following logs for ${name}`,
  });
  SpinniesManager.add('stopMessage', {
    text: `> Press ${chalk.bold('q')} to stop following`,
    status: 'non-spinnable',
  });

  handleUserInput();

  if (initialAfter) {
    await tail(initialAfter);
  }
}

export async function outputBuildLog(buildLogUrl: string): Promise<string> {
  if (!buildLogUrl) {
    logger.debug(
      'Unable to display build output. No build log URL was provided.'
    );
    return '';
  }

  return new Promise(resolve => {
    try {
      https
        .get(buildLogUrl, response => {
          if (response.statusCode === 404) {
            resolve('');
          }

          let data = '';
          response.on('data', chunk => {
            data += chunk;
          });
          response.on('end', () => {
            logger.log(data);
            resolve(data);
          });
        })
        .on('error', () => {
          logger.error('The build log could not be retrieved.');
        });
    } catch (e) {
      logger.error('The build log could not be retrieved.');
      resolve('');
    }
  });
}
