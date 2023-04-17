const cliProgress = require('cli-progress');
const {
  getConfig,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/cli-lib');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { EXIT_CODES } = require('./enums/exitCodes');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');
const { fetchTaskStatus, fetchTypes } = require('@hubspot/cli-lib/sandboxes');
const { handleExit, handleKeypress } = require('@hubspot/cli-lib/lib/process');
const { accountNameExistsInConfig } = require('@hubspot/cli-lib/lib/config');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');

const STANDARD_SANDBOX = 'standard';
const DEVELOPER_SANDBOX = 'developer';

const sandboxTypeMap = {
  DEV: DEVELOPER_SANDBOX,
  dev: DEVELOPER_SANDBOX,
  DEVELOPER: DEVELOPER_SANDBOX,
  developer: DEVELOPER_SANDBOX,
  DEVELOPMENT: DEVELOPER_SANDBOX,
  development: DEVELOPER_SANDBOX,
  STANDARD: STANDARD_SANDBOX,
  standard: STANDARD_SANDBOX,
};

const sandboxApiTypeMap = {
  standard: 1,
  developer: 2,
};

const getSandboxTypeAsString = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

function getAccountName(config) {
  const isSandbox =
    config.sandboxAccountType && config.sandboxAccountType !== null;
  const sandboxName = `[${getSandboxTypeAsString(
    config.sandboxAccountType
  )} sandbox] `;
  return `${config.name} ${isSandbox ? sandboxName : ''}(${config.portalId})`;
}

function getHasSandboxesByType(parentAccountConfig, type) {
  const config = getConfig();
  const parentPortalId = parentAccountConfig.portalId;
  for (const portal of config.portals) {
    if (
      (portal.parentAccountId !== null ||
        portal.parentAccountId !== undefined) &&
      portal.parentAccountId === parentPortalId &&
      portal.sandboxAccountType &&
      sandboxTypeMap[portal.sandboxAccountType] === type
    ) {
      return true;
    }
  }
  return false;
}

function getSandboxLimit(error) {
  // Error context should contain a limit property with a list of one number. That number is the current limit
  const limit = error.context && error.context.limit && error.context.limit[0];
  return limit ? parseInt(limit, 10) : 1; // Default to 1
}

// Fetches available sync types for a given sandbox portal
async function getAvailableSyncTypes(parentAccountConfig, config) {
  const parentPortalId = parentAccountConfig.portalId;
  const portalId = config.portalId;
  const syncTypes = await fetchTypes(parentPortalId, portalId);
  return syncTypes.map(t => ({ type: t.name }));
}

/**
 * @param {String} env - Environment (QA/Prod)
 * @param {Object} result - Sandbox instance returned from API
 * @param {Boolean} force - Force flag to skip prompt
 * @returns {String} validName saved into config
 */
const saveSandboxToConfig = async (env, result, force = false) => {
  // const configData = { env, personalAccessKey: result.personalAccessKey };
  // TODO: Temporary, remove
  const configData = await personalAccessKeyPrompt({
    env,
    account: result.sandbox.sandboxHubId,
  });
  // End temporary section
  const updatedConfig = await updateConfigWithPersonalAccessKey(configData);
  if (!updatedConfig) {
    throw new Error('Failed to update config with personal access key.');
  }

  let validName = updatedConfig.name;
  if (!updatedConfig.name) {
    const nameForConfig = result.sandbox.name
      .toLowerCase()
      .split(' ')
      .join('-');
    validName = nameForConfig;
    const invalidAccountName = accountNameExistsInConfig(nameForConfig);
    if (invalidAccountName) {
      if (!force) {
        logger.log(
          i18n(
            `cli.lib.prompts.enterAccountNamePrompt.errors.accountNameExists`,
            { name: nameForConfig }
          )
        );
        const { name: promptName } = await enterAccountNamePrompt(
          nameForConfig
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + Math.floor(Math.random() * 10);
      }
    }
  }
  updateAccountConfig({
    ...updatedConfig,
    environment: updatedConfig.env,
    tokenInfo: updatedConfig.auth.tokenInfo,
    name: validName,
  });
  writeConfig();

  logger.log('');
  return validName;
};

const ACTIVE_TASK_POLL_INTERVAL = 1000;

const isTaskComplete = task => {
  if (!task) {
    return false;
  }
  return task.status === 'COMPLETE';
};

/**
 * @param {Number} accountId - Parent portal ID (needs sandbox scopes)
 * @param {String} taksId - Task ID to poll
 * @param {String} syncStatusUrl - Link to UI to check polling status
 * @param {Boolean} allowEarlyTermination - Option to allow a keypress to terminate early
 * @returns {Promise} Interval runs until sync task status is equal to 'COMPLETE'
 */
function pollSyncTaskStatus(
  accountId,
  taskId,
  syncStatusUrl,
  allowEarlyTermination = true
) {
  const i18nKey = 'cli.commands.sandbox.subcommands.sync.types';
  // TODO: Extract cli progress into util
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
  if (!allowEarlyTermination) {
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
  }
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
  STANDARD_SANDBOX,
  DEVELOPER_SANDBOX,
  sandboxTypeMap,
  sandboxApiTypeMap,
  getSandboxTypeAsString,
  getAccountName,
  saveSandboxToConfig,
  getHasSandboxesByType,
  getSandboxLimit,
  getAvailableSyncTypes,
  pollSyncTaskStatus,
};
