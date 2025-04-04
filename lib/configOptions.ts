import { logger } from '@hubspot/local-dev-lib/logger';
import {
  updateAllowUsageTracking,
  updateDefaultCmsPublishMode,
  updateHttpTimeout,
} from '@hubspot/local-dev-lib/config';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { CMS_PUBLISH_MODE } from '@hubspot/local-dev-lib/constants/files';
import { commaSeparatedValues } from '@hubspot/local-dev-lib/text';
import { trackCommandUsage } from './usageTracking';
import { promptUser } from './prompts/promptUtils';
import { i18n } from '../lib/lang';

async function enableOrDisableUsageTracking(): Promise<boolean> {
  const { isEnabled } = await promptUser<{ isEnabled: boolean }>([
    {
      type: 'list',
      name: 'isEnabled',
      pageSize: 20,
      message: i18n(
        `commands.config.subcommands.set.options.allowUsageTracking.promptMessage`
      ),
      choices: [
        {
          name: i18n(
            `commands.config.subcommands.set.options.allowUsageTracking.labels.enabled`
          ),
          value: true,
        },
        {
          name: i18n(
            `commands.config.subcommands.set.options.allowUsageTracking.labels.disabled`
          ),
          value: false,
        },
      ],
      default: true,
    },
  ]);

  return isEnabled;
}

export async function setAllowUsageTracking({
  accountId,
  allowUsageTracking,
}: {
  accountId: number;
  allowUsageTracking?: boolean;
}): Promise<void> {
  trackCommandUsage('config-set-allow-usage-tracking', undefined, accountId);

  let isEnabled: boolean;

  if (typeof allowUsageTracking === 'boolean') {
    isEnabled = allowUsageTracking;
  } else {
    isEnabled = await enableOrDisableUsageTracking();
  }

  updateAllowUsageTracking(isEnabled);

  logger.success(
    i18n(`commands.config.subcommands.set.options.allowUsageTracking.success`, {
      isEnabled: isEnabled.toString(),
    })
  );
}

const ALL_CMS_PUBLISH_MODES = Object.values(CMS_PUBLISH_MODE);

async function selectCmsPublishMode(): Promise<CmsPublishMode> {
  const { cmsPublishMode } = await promptUser<{
    cmsPublishMode: CmsPublishMode;
  }>([
    {
      type: 'list',
      name: 'cmsPublishMode',
      pageSize: 20,
      message: i18n(
        `commands.config.subcommands.set.options.defaultMode.promptMessage`
      ),
      choices: ALL_CMS_PUBLISH_MODES,
      default: CMS_PUBLISH_MODE.publish,
    },
  ]);

  return cmsPublishMode;
}

export async function setDefaultCmsPublishMode({
  accountId,
  defaultCmsPublishMode,
}: {
  accountId: number;
  defaultCmsPublishMode?: CmsPublishMode;
}): Promise<void> {
  trackCommandUsage('config-set-default-mode', undefined, accountId);

  let newDefault: CmsPublishMode;

  if (!defaultCmsPublishMode) {
    newDefault = await selectCmsPublishMode();
  } else if (
    defaultCmsPublishMode &&
    ALL_CMS_PUBLISH_MODES.find(m => m === defaultCmsPublishMode)
  ) {
    newDefault = defaultCmsPublishMode;
  } else {
    logger.error(
      i18n(`commands.config.subcommands.set.options.defaultMode.error`, {
        validModes: commaSeparatedValues(ALL_CMS_PUBLISH_MODES),
      })
    );
    newDefault = await selectCmsPublishMode();
  }

  updateDefaultCmsPublishMode(newDefault);

  logger.success(
    i18n(`commands.config.subcommands.set.options.defaultMode.success`, {
      mode: newDefault,
    })
  );
}

async function enterTimeout(): Promise<string> {
  const { timeout } = await promptUser<{ timeout: string }>([
    {
      name: 'timeout',
      message: i18n(
        `commands.config.subcommands.set.options.httpTimeout.promptMessage`
      ),
      type: 'input',
      default: 30000,
    },
  ]);

  return timeout;
}

export async function setHttpTimeout({
  accountId,
  httpTimeout,
}: {
  accountId: number;
  httpTimeout?: string;
}): Promise<void> {
  trackCommandUsage('config-set-http-timeout', undefined, accountId);

  let newHttpTimeout: string;

  if (!httpTimeout) {
    newHttpTimeout = await enterTimeout();
  } else {
    newHttpTimeout = httpTimeout;
  }

  updateHttpTimeout(newHttpTimeout);

  logger.success(
    i18n(`commands.config.subcommands.set.options.httpTimeout.success`, {
      timeout: newHttpTimeout,
    })
  );
}
