const chalk = require('chalk');
const { i18n } = require('./lang');
const { handleExit, handleKeypress } = require('./process');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { EXIT_CODES } = require('./enums/exitCodes');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');
const {
  fetchTaskStatus,
  fetchTypes,
  getSandboxUsageLimits,
} = require('@hubspot/local-dev-lib/sandboxes');
const {
  accountNameExistsInConfig,
  getConfig,
  writeConfig,
  updateAccountConfig,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const CliProgressMultibarManager = require('./CliProgressMultibarManager');
const { promptUser } = require('./prompts/promptUtils');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');

const STANDARD_SANDBOX = 'standard';
const DEVELOPER_SANDBOX = 'developer';

const syncTypes = {
  OBJECT_RECORDS: 'object-records',
};

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

const isSandbox = config =>
  config.sandboxAccountType && config.sandboxAccountType !== null;

function getAccountName(config, bold = true) {
  const sandboxName = `[${getSandboxTypeAsString(
    config.sandboxAccountType
  )} sandbox] `;

  const message = `${config.name} ${isSandbox(config) ? sandboxName : ''}(${
    config.portalId
  })`;

  return bold ? chalk.bold(message) : message;
}

function getHasSandboxesByType(parentAccountConfig, type) {
  const config = getConfig();
  const parentPortalId = getAccountId(parentAccountConfig.portalId);
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
  const parentPortalId = getAccountId(parentAccountConfig.portalId);
  const portalId = getAccountId(config.portalId);
  const syncTypes = await fetchTypes(parentPortalId, portalId);
  if (!syncTypes) {
    throw new Error(
      'Unable to fetch available sandbox sync types. Please try again.'
    );
  }
  return syncTypes.map(t => ({ type: t.name }));
}

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {Array} availableSyncTasks - Array of available sync tasks
 * @param {Boolean} skipPrompt - Option to skip contact records prompt and return all available sync tasks
 * @returns {Array} Adjusted available sync task items
 */
const getSyncTypesWithContactRecordsPrompt = async (
  accountConfig,
  syncTasks,
  skipPrompt = false
) => {
  // Fetches sync types based on default account. Parent account required for fetch

  if (
    syncTasks &&
    syncTasks.some(t => t.type === syncTypes.OBJECT_RECORDS) &&
    !skipPrompt
  ) {
    const { contactRecordsSyncPrompt } = await promptUser([
      {
        name: 'contactRecordsSyncPrompt',
        type: 'confirm',
        message: i18n(
          `cli.lib.sandbox.sync.confirm.syncContactRecords.${
            sandboxTypeMap[accountConfig.sandboxAccountType]
          }`
        ),
      },
    ]);
    if (!contactRecordsSyncPrompt) {
      return syncTasks.filter(t => t.type !== syncTypes.OBJECT_RECORDS);
    }
  }
  return syncTasks;
};

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {String} sandboxType - Sandbox type for limit validation
 * @param {String} env - Environment
 * @returns {null}
 */
const validateSandboxUsageLimits = async (accountConfig, sandboxType, env) => {
  const accountId = getAccountId(accountConfig.portalId);
  const usage = await getSandboxUsageLimits(accountId);
  if (!usage) {
    throw new Error('Unable to fetch sandbox usage limits. Please try again.');
  }
  if (sandboxType === DEVELOPER_SANDBOX) {
    if (usage['DEVELOPER'].available === 0) {
      const devSandboxLimit = usage['DEVELOPER'].limit;
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasSandboxesByType(
        accountConfig,
        DEVELOPER_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        throw new Error(
          i18n(
            `cli.lib.sandbox.create.failure.alreadyInConfig.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `cli.lib.sandbox.create.failure.limit.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/development`,
            }
          )
        );
      }
    }
  }
  if (sandboxType === STANDARD_SANDBOX) {
    if (usage['STANDARD'].available === 0) {
      const standardSandboxLimit = usage['STANDARD'].limit;
      const plural = standardSandboxLimit !== 1;
      const hasStandardSandboxes = getHasSandboxesByType(
        accountConfig,
        STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        throw new Error(
          i18n(
            `cli.lib.sandbox.create.failure.alreadyInConfig.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `cli.lib.sandbox.create.failure.limit.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/standard`,
            }
          )
        );
      }
    }
  }
};

/**
 * @param {String} env - Environment (QA/Prod)
 * @param {Object} result - Sandbox instance returned from API
 * @param {Boolean} force - Force flag to skip prompt
 * @returns {String} validName saved into config
 */
const saveSandboxToConfig = async (env, result, force = false) => {
  let configData = { env, personalAccessKey: result.personalAccessKey };
  if (!result.personalAccessKey) {
    configData = await personalAccessKeyPrompt({
      env,
      account: result.sandbox.sandboxHubId,
    });
  }
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
        logger.log('');
        logger.warn(
          i18n(
            `cli.lib.prompts.enterAccountNamePrompt.errors.accountNameExists`,
            { name: nameForConfig }
          )
        );
        const { name: promptName } = await enterAccountNamePrompt(
          nameForConfig + `_${result.sandbox.sandboxHubId}`
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + `_${result.sandbox.sandboxHubId}`;
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

const incrementBy = (value, multiplier = 3) => {
  return Math.min(value + Math.floor(Math.random() * multiplier), 99);
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
  const i18nKey = 'cli.lib.sandbox.sync.types';
  const progressBar = CliProgressMultibarManager.init();
  const mergeTasks = {
    'lead-flows': 'forms', // lead-flows are a subset of forms. We combine these in the UI as a single item, so we want to merge here for consistency.
  };
  let progressCounter = {};
  let pollInterval;
  // Handle manual exit for return key and ctrl+c
  const onTerminate = () => {
    clearInterval(pollInterval);
    progressBar.stop();
    logger.log('');
    logger.log('Exiting, sync will continue in the background.');
    logger.log('');
    logger.log(
      i18n('cli.lib.sandbox.sync.info.syncStatus', {
        url: syncStatusUrl,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  };
  if (allowEarlyTermination) {
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
          if (!progressBar.get(taskType) && !mergeTasks[taskType]) {
            // skip creation of lead-flows bar because we're combining lead-flows into the forms bar, otherwise create a bar instance for the type
            progressCounter[taskType] = 0;
            progressBar.create(taskType, 100, 0, {
              label: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (mergeTasks[taskType]) {
            // It's a lead-flow here, merge status into the forms progress bar
            if (!progressCounter[mergeTasks[taskType]]) {
              progressCounter[mergeTasks[taskType]] = 0;
            }
            const formsTask = taskResult.tasks.filter(
              t => t.type === mergeTasks[taskType]
            )[0];
            const formsTaskStatus = formsTask.status;
            const leadFlowsTaskStatus = task.status;
            if (
              formsTaskStatus !== 'COMPLETE' ||
              leadFlowsTaskStatus !== 'COMPLETE'
            ) {
              // Randomly increment bar while sync is in progress. Sandboxes currently does not have an accurate measurement for progress.
              progressCounter[mergeTasks[taskType]] = incrementBy(
                progressCounter[mergeTasks[taskType]]
              );
              progressBar.update(
                mergeTasks[taskType],
                progressCounter[mergeTasks[taskType]],
                {
                  label: i18n(`${i18nKey}.${mergeTasks[taskType]}.label`),
                }
              );
            }
          }
          if (progressBar.get(taskType) && task.status === 'COMPLETE') {
            progressBar.update(taskType, 100, {
              label: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (
            // Do not start incrementing for tasks still in PENDING state
            progressBar.get(taskType) &&
            task.status === 'PROCESSING'
          ) {
            // Randomly increment bar while sync is in progress. Sandboxes currently does not have an accurate measurement for progress.
            progressCounter[taskType] = incrementBy(
              progressCounter[taskType],
              taskType === syncTypes.OBJECT_RECORDS ? 2 : 3 // slower progress for object-records, sync can take up to a few minutes
            );
            progressBar.update(taskType, progressCounter[taskType], {
              label: i18n(`${i18nKey}.${taskType}.label`),
            });
          }
        }
      } else {
        clearInterval(pollInterval);
        reject();
        progressBar.stop();
      }
      if (isTaskComplete(taskResult)) {
        clearInterval(pollInterval);
        resolve(taskResult);
        progressBar.stop();
      }
    }, ACTIVE_TASK_POLL_INTERVAL);
  });
}

module.exports = {
  STANDARD_SANDBOX,
  DEVELOPER_SANDBOX,
  sandboxTypeMap,
  sandboxApiTypeMap,
  syncTypes,
  isSandbox,
  getSandboxTypeAsString,
  getAccountName,
  saveSandboxToConfig,
  getHasSandboxesByType,
  getSandboxLimit,
  validateSandboxUsageLimits,
  getAvailableSyncTypes,
  getSyncTypesWithContactRecordsPrompt,
  pollSyncTaskStatus,
};
