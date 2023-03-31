const cliProgress = require('cli-progress');
const {
  getConfig,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/cli-lib');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { EXIT_CODES } = require('./enums/exitCodes');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');
const {
  setAsDefaultAccountPrompt,
} = require('./prompts/setAsDefaultAccountPrompt');
const { uiFeatureHighlight } = require('./ui');
const { fetchTaskStatus, fetchTypes } = require('@hubspot/cli-lib/sandboxes');
const { handleExit, handleKeypress } = require('@hubspot/cli-lib/lib/process');

const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

function getAccountName(config) {
  const isSandbox =
    config.sandboxAccountType && config.sandboxAccountType !== null;
  const sandboxName = `[${getSandboxType(config.sandboxAccountType)} sandbox] `;
  return `${config.name} ${isSandbox ? sandboxName : ''}(${config.portalId})`;
}

function getHasDevelopmentSandboxes(parentAccountConfig) {
  const config = getConfig();
  const parentPortalId = parentAccountConfig.portalId;
  for (const portal of config.portals) {
    if (
      (portal.parentAccountId !== null ||
        portal.parentAccountId !== undefined) &&
      portal.parentAccountId === parentPortalId &&
      portal.sandboxAccountType &&
      portal.sandboxAccountType === 'DEVELOPER'
    ) {
      return true;
    }
  }
  return false;
}

function getDevSandboxLimit(message) {
  // Return the first grouping of digits, in this case the count from the string
  const regex = /\d+/;
  const match = message.match(regex);
  return match && parseInt(match[0], 10);
}

// Fetches available sync types for a given sandbox portal
async function getAvailableSyncTypes(parentAccountConfig, config) {
  const parentPortalId = parentAccountConfig.portalId;
  const portalId = config.portalId;
  const syncTypes = await fetchTypes(parentPortalId, portalId);
  return syncTypes.map(t => ({ type: t.name }));
}

const sandboxCreatePersonalAccessKeyFlow = async (env, account, name) => {
  const configData = await personalAccessKeyPrompt({ env, account });
  const updatedConfig = await updateConfigWithPersonalAccessKey(configData);

  if (!updatedConfig) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  let validName = updatedConfig.name;

  if (!updatedConfig.name) {
    const nameForConfig = name
      .toLowerCase()
      .split(' ')
      .join('-');
    const { name: promptName } = await enterAccountNamePrompt(nameForConfig);
    validName = promptName;
  }

  updateAccountConfig({
    ...updatedConfig,
    environment: updatedConfig.env,
    tokenInfo: updatedConfig.auth.tokenInfo,
    name: validName,
  });
  writeConfig();

  const setAsDefault = await setAsDefaultAccountPrompt(validName);

  logger.log('');
  if (setAsDefault) {
    logger.success(
      i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
        accountName: validName,
      })
    );
  } else {
    const config = getConfig();
    logger.info(
      i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
        accountName: config.defaultPortal,
      })
    );
  }
  logger.success(
    i18n('cli.commands.sandbox.subcommands.create.success.configFileUpdated', {
      configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
      account: validName,
    })
  );
  uiFeatureHighlight([
    'accountsUseCommand',
    'accountOption',
    'accountsListCommand',
  ]);
};

const ACTIVE_TASK_POLL_INTERVAL = 1000;

const isTaskComplete = task => {
  if (!task) {
    return false;
  }
  return task.status === 'COMPLETE';
};

// Returns a promise to poll a sync task with taskId. Interval runs until sync task status is equal to 'COMPLETE'
function pollSyncTaskStatus(accountId, taskId, syncStatusUrl) {
  const i18nKey = 'cli.commands.sandbox.subcommands.sync.types';
  const multibar = new cliProgress.MultiBar(
    {
      hideCursor: true,
      format: '[{bar}] {percentage}% | {taskType}',
      gracefulExit: true,
    },
    cliProgress.Presets.rect
  );
  const mergeTasks = {
    'lead-flows': 'forms', // lead-flows are a subset of forms. We combine these in the UI as a single item, so we want to merge here for consistency.
  };
  const barInstances = {};
  let pollInterval;
  // Handle manual exit for return key and ctrl+c
  const onTerminate = () => {
    clearInterval(pollInterval);
    multibar.stop();
    logger.log('');
    logger.log('Exiting, sync will continue in the background.');
    logger.log('');
    logger.log(
      i18n('cli.commands.sandbox.subcommands.sync.info.syncStatus', {
        url: syncStatusUrl,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  };
  handleExit(onTerminate);
  handleKeypress(key => {
    if (
      (key && key.ctrl && key.name == 'c') ||
      key.name === 'enter' ||
      key.name === 'return'
    ) {
      onTerminate();
    }
  });
  return new Promise((resolve, reject) => {
    pollInterval = setInterval(async () => {
      const taskResult = await fetchTaskStatus(accountId, taskId).catch(reject);
      if (taskResult.tasks) {
        // Array of sync tasks, eg: workflows, pipelines, object-schemas, etc. with each task containing a status of 'PENDING', 'IN_PROGRESS', 'COMPLETE', and 'FAILURE'
        for (const task of taskResult.tasks) {
          // For each sync task, show a progress bar and increment bar each time we run this interval until status is 'COMPLETE'
          const taskType = task.type;
          if (!barInstances[taskType] && !mergeTasks[taskType]) {
            // skip creation of lead-flows bar because we're combining lead-flows into the forms bar
            barInstances[taskType] = multibar.create(100, 0, {
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (mergeTasks[taskType]) {
            // If its a lead-flow, merge status into the forms progress bar
            const formsTask = taskResult.tasks.filter(
              t => t.type === mergeTasks[taskType]
            )[0];
            const formsTaskStatus = formsTask.status;
            const leadFlowsTaskStatus = task.status;
            if (
              formsTaskStatus !== 'COMPLETE' ||
              leadFlowsTaskStatus !== 'COMPLETE'
            ) {
              barInstances[mergeTasks[taskType]].increment(
                Math.floor(Math.random() * 3),
                {
                  taskType: i18n(`${i18nKey}.${mergeTasks[taskType]}.label`),
                }
              );
            }
          }
          if (barInstances[taskType] && task.status === 'COMPLETE') {
            barInstances[taskType].update(100, {
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (barInstances[taskType] && task.status === 'PROCESSING') {
            // Do not increment for tasks still in PENDING state
            barInstances[taskType].increment(Math.floor(Math.random() * 3), {
              // Randomly increment bar by 0 - 2 while sync is in progress. Sandboxes currently does not have an accurate measurement for progress.
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          }
        }
      } else {
        clearInterval(pollInterval);
        reject();
        multibar.stop();
      }
      if (isTaskComplete(taskResult)) {
        clearInterval(pollInterval);
        resolve(taskResult);
        multibar.stop();
      }
    }, ACTIVE_TASK_POLL_INTERVAL);
  });
}

module.exports = {
  getSandboxType,
  getAccountName,
  getHasDevelopmentSandboxes,
  getDevSandboxLimit,
  getAvailableSyncTypes,
  sandboxCreatePersonalAccessKeyFlow,
  pollSyncTaskStatus,
};
