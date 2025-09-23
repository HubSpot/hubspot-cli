import {
  updateAllowUsageTracking,
  updateAllowAutoUpdates,
  updateDefaultCmsPublishMode,
  updateHttpTimeout,
  isConfigFlagEnabled,
  updateAutoOpenBrowser,
} from '@hubspot/local-dev-lib/config';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { CMS_PUBLISH_MODE } from '@hubspot/local-dev-lib/constants/files';
import { commaSeparatedValues } from '@hubspot/local-dev-lib/text';
import { trackCommandUsage } from './usageTracking.js';
import { promptUser, listPrompt } from './prompts/promptUtils.js';
import { lib } from '../lang/en.js';
import { uiLogger } from './ui/logger.js';

async function enableOrDisableBooleanFieldPrompt(
  fieldName: string
): Promise<boolean> {
  const isEnabled = await listPrompt<boolean>(
    lib.configOptions.enableOrDisableBooleanFieldPrompt.message(fieldName),
    {
      choices: [
        {
          name: lib.configOptions.enableOrDisableBooleanFieldPrompt.labels
            .enabled,
          value: true,
        },
        {
          name: lib.configOptions.enableOrDisableBooleanFieldPrompt.labels
            .disabled,
          value: false,
        },
      ],
      defaultAnswer: true,
    }
  );

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
    isEnabled = await enableOrDisableBooleanFieldPrompt(
      lib.configOptions.setAllowUsageTracking.fieldName
    );
  }

  updateAllowUsageTracking(isEnabled);

  uiLogger.success(
    lib.configOptions.setAllowUsageTracking.success(isEnabled.toString())
  );
}

export async function setAllowAutoUpdates({
  accountId,
  allowAutoUpdates,
}: {
  accountId: number;
  allowAutoUpdates?: boolean;
}): Promise<void> {
  trackCommandUsage('config-set-allow-auto-updates', undefined, accountId);

  let isEnabled: boolean;

  if (typeof allowAutoUpdates === 'boolean') {
    isEnabled = allowAutoUpdates;
  } else {
    isEnabled = await enableOrDisableBooleanFieldPrompt(
      lib.configOptions.setAllowAutoUpdates.fieldName
    );
  }

  updateAllowAutoUpdates(isEnabled);

  uiLogger.success(
    lib.configOptions.setAllowAutoUpdates.success(isEnabled.toString())
  );
}

const ALL_CMS_PUBLISH_MODES = Object.values(CMS_PUBLISH_MODE);

async function selectCmsPublishMode(): Promise<CmsPublishMode> {
  const cmsPublishMode = await listPrompt<CmsPublishMode>(
    lib.configOptions.setDefaultCmsPublishMode.promptMessage,
    {
      choices: ALL_CMS_PUBLISH_MODES,
      defaultAnswer: CMS_PUBLISH_MODE.publish,
    }
  );

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
    uiLogger.error(
      lib.configOptions.setDefaultCmsPublishMode.error(
        commaSeparatedValues(ALL_CMS_PUBLISH_MODES)
      )
    );
    newDefault = await selectCmsPublishMode();
  }

  updateDefaultCmsPublishMode(newDefault);

  uiLogger.success(
    lib.configOptions.setDefaultCmsPublishMode.success(newDefault)
  );
}

async function enterTimeout(): Promise<string> {
  const { timeout } = await promptUser<{ timeout: string }>([
    {
      name: 'timeout',
      message: lib.configOptions.setHttpTimeout.promptMessage,
      type: 'input',
      default: 30000,
      validate: (timeout: string) => {
        const timeoutNum = parseInt(timeout, 10);
        if (isNaN(timeoutNum) || timeoutNum < 3000) {
          return lib.configOptions.setHttpTimeout.error(timeout);
        }
        return true;
      },
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

  uiLogger.success(lib.configOptions.setHttpTimeout.success(newHttpTimeout));
}

export async function setAutoOpenBrowser({
  accountId,
  autoOpenBrowser,
}: {
  accountId: number;
  autoOpenBrowser: boolean;
}): Promise<void> {
  trackCommandUsage('config-set-auto-open-browser', undefined, accountId);

  updateAutoOpenBrowser(autoOpenBrowser);

  uiLogger.success(
    autoOpenBrowser
      ? lib.configOptions.setAutoOpenBrowser.enabled
      : lib.configOptions.setAutoOpenBrowser.disabled
  );
}

export function isAutoOpenBrowserEnabled(): boolean {
  return isConfigFlagEnabled('autoOpenBrowser', true);
}
