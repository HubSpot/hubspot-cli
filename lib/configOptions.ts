import {
  updateAllowUsageTracking,
  updateAllowAutoUpdates,
  updateDefaultCmsPublishMode,
  updateHttpTimeout,
  updateAutoOpenBrowser,
} from '@hubspot/local-dev-lib/config';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { CMS_PUBLISH_MODE } from '@hubspot/local-dev-lib/constants/files';
import { commaSeparatedValues } from '@hubspot/local-dev-lib/text';
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
  allowUsageTracking,
}: {
  accountId: number;
  allowUsageTracking?: boolean;
}): Promise<boolean> {
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

  return isEnabled;
}

export async function setAllowAutoUpdates({
  allowAutoUpdates,
}: {
  accountId: number;
  allowAutoUpdates?: boolean;
}): Promise<boolean> {
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

  return isEnabled;
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
  defaultCmsPublishMode,
}: {
  accountId: number;
  defaultCmsPublishMode?: CmsPublishMode;
}): Promise<CmsPublishMode> {
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

  return newDefault;
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
  httpTimeout,
}: {
  accountId: number;
  httpTimeout?: string;
}): Promise<string> {
  let newHttpTimeout: string;

  if (!httpTimeout) {
    newHttpTimeout = await enterTimeout();
  } else {
    newHttpTimeout = httpTimeout;
  }

  updateHttpTimeout(newHttpTimeout);

  uiLogger.success(lib.configOptions.setHttpTimeout.success(newHttpTimeout));

  return newHttpTimeout;
}

export async function setAutoOpenBrowser({
  autoOpenBrowser,
}: {
  accountId: number;
  autoOpenBrowser: boolean;
}): Promise<boolean> {
  updateAutoOpenBrowser(autoOpenBrowser);

  uiLogger.success(
    autoOpenBrowser
      ? lib.configOptions.setAutoOpenBrowser.enabled
      : lib.configOptions.setAutoOpenBrowser.disabled
  );

  return autoOpenBrowser;
}
