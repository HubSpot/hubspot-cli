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

const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

function getAccountName(config) {
  const isSandbox =
    config.sandboxAccountType && config.sandboxAccountType !== null;
  const sandboxName = `[${getSandboxType(config.sandboxAccountType)} sandbox] `;
  return `${config.name} ${isSandbox ? sandboxName : ''}(${config.portalId})`;
}

async function getSyncTypes(parentAccountConfig, config) {
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

function pollSyncStatus(accountId, taskId) {
  const i18nKey = 'cli.commands.sandbox.subcommands.sync.types';
  const multibar = new cliProgress.MultiBar(
    {
      hideCursor: true,
      format: '[{bar}] {percentage}% | {taskType}',
    },
    cliProgress.Presets.rect
  );
  const mergeTasks = {
    'lead-flows': 'forms', // Since UI only shows forms, merge lead-flows into forms progress
  };
  const barInstances = {};
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const taskResult = await fetchTaskStatus(accountId, taskId).catch(reject);
      if (taskResult.tasks) {
        for (const task of taskResult.tasks) {
          const taskType = task.type;
          if (!barInstances[taskType] && !mergeTasks[taskType]) {
            // skip creation of lead-flows bar
            barInstances[taskType] = multibar.create(100, 0, {
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (mergeTasks[taskType]) {
            // Its a lead-flow
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
          } else if (barInstances[taskType] && task.status === 'COMPLETE') {
            barInstances[taskType].update(100, {
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          } else if (barInstances[taskType]) {
            barInstances[taskType].increment(Math.floor(Math.random() * 3), {
              taskType: i18n(`${i18nKey}.${taskType}.label`),
            });
          }
        }
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
  getSyncTypes,
  sandboxCreatePersonalAccessKeyFlow,
  pollSyncStatus,
};