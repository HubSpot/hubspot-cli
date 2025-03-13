#!/usr/bin/env node

const yargs = require('yargs');
const updateNotifier = require('update-notifier');
const chalk = require('chalk');

const { logger } = require('@hubspot/local-dev-lib/logger');
const { addUserAgentHeader } = require('@hubspot/local-dev-lib/http');
const {
  globalConfigFileExists,
  getConfigFilePath,
  isConfigValid,
  getConfigAccountIfExists,
} = require('@hubspot/local-dev-lib/config');
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';
const { logError } = require('../lib/errorHandlers/index');
const { setLogLevel, getCommandName } = require('../lib/commonOpts');
const { validateAccount } = require('../lib/validation');
const {
  trackHelpUsage,
  trackConvertFieldsUsage,
} = require('../lib/usageTracking');
const { getIsInProject } = require('../lib/projects');
const pkg = require('../package.json');
const { i18n } = require('../lib/lang');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { UI_COLORS, uiCommandReference, uiDeprecatedTag } = require('../lib/ui');
const { checkAndWarnGitInclusion } = require('../lib/ui/git');

const removeCommand = require('../commands/remove');
const initCommand = require('../commands/init');
const logsCommand = require('../commands/logs');
const lintCommand = require('../commands/lint');
const hubdbCommand = require('../commands/hubdb');
const watchCommand = require('../commands/watch');
const authCommand = require('../commands/auth');
const uploadCommand = require('../commands/upload');
const createCommand = require('../commands/create');
const fetchCommand = require('../commands/fetch');
const filemanagerCommand = require('../commands/filemanager');
const secretCommands = require('../commands/secret');
const customObjectCommand = require('../commands/customObject');
const functionCommands = require('../commands/function');
const listCommand = require('../commands/list');
const openCommand = require('../commands/open');
const mvCommand = require('../commands/mv');
const projectCommands = require('../commands/project');
const themeCommand = require('../commands/theme');
const moduleCommand = require('../commands/module');
const configCommand = require('../commands/config');
const accountCommands = require('../commands/account');
const sandboxesCommand = require('../commands/sandbox');
const cmsCommand = require('../commands/cms');
const feedbackCommand = require('../commands/feedback');
const doctorCommand = require('../commands/doctor');
const completionCommand = require('../commands/completion');

const notifier = updateNotifier({
  pkg: { ...pkg, name: '@hubspot/cli' },
  distTag: 'latest',
  shouldNotifyInNpmScript: true,
});

const i18nKey = 'commands.generalErrors';

const CMS_CLI_PACKAGE_NAME = '@hubspot/cms-cli';

notifier.notify({
  message:
    pkg.name === CMS_CLI_PACKAGE_NAME
      ? i18n(`${i18nKey}.updateNotify.cmsUpdateNotification`, {
          packageName: CMS_CLI_PACKAGE_NAME,
          updateCommand: uiCommandReference('{updateCommand}'),
        })
      : i18n(`${i18nKey}.updateNotify.cliUpdateNotification`, {
          updateCommand: uiCommandReference('{updateCommand}'),
        }),
  defer: false,
  boxenOptions: {
    borderColor: UI_COLORS.MARIGOLD_DARK,
    margin: 1,
    padding: 1,
    textAlignment: 'center',
    borderStyle: 'round',
    title:
      pkg.name === CMS_CLI_PACKAGE_NAME
        ? null
        : chalk.bold(i18n(`${i18nKey}.updateNotify.notifyTitle`)),
  },
});

const getTerminalWidth = () => {
  const width = yargs.terminalWidth();

  if (width >= 100) return width * 0.9;

  return width;
};

const handleFailure = (msg, err, yargs) => {
  if (msg) {
    logger.error(msg);
  } else if (err) {
    logError(err);
  }

  if (msg === null) {
    yargs.showHelp('log');
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    process.exit(EXIT_CODES.ERROR);
  }
};

const performChecks = argv => {
  // "hs config set default-account" has moved to "hs accounts use"
  if (
    argv._[0] === 'config' &&
    argv._[1] === 'set' &&
    argv._[2] === 'default-account'
  ) {
    logger.error(i18n(`${i18nKey}.setDefaultAccountMoved`));
    process.exit(EXIT_CODES.ERROR);
  }

  // Require "project" command when running upload/watch inside of a project
  if (argv._.length === 1 && ['upload', 'watch'].includes(argv._[0])) {
    if (getIsInProject(argv.src)) {
      logger.error(
        i18n(`${i18nKey}.srcIsProject`, {
          src: argv.src || './',
          command: argv._.join(' '),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    } else {
      return true;
    }
  } else {
    return true;
  }
};

const setRequestHeaders = () => {
  addUserAgentHeader('HubSpot CLI', pkg.version);
};

const isTargetedCommand = (options, commandMap) => {
  const checkCommand = (options, commandMap) => {
    const currentCommand = options._[0];

    if (!commandMap[currentCommand]) {
      return false;
    }

    if (commandMap[currentCommand].target) {
      return true;
    }

    const subCommands = commandMap[currentCommand].subCommands || {};
    if (options._.length > 1) {
      return checkCommand({ _: options._.slice(1) }, subCommands);
    }

    return false;
  };

  return checkCommand(options, commandMap);
};

const SKIP_CONFIG_VALIDATION = {
  init: { target: true },
  auth: { target: true },
};

const handleDeprecatedEnvVariables = options => {
  // HUBSPOT_PORTAL_ID is deprecated, but we'll still support it for now
  // The HubSpot GH Deploy Action still uses HUBSPOT_PORTAL_ID
  if (
    options.useEnv &&
    process.env.HUBSPOT_PORTAL_ID &&
    !process.env.HUBSPOT_ACCOUNT_ID
  ) {
    uiDeprecatedTag(
      i18n(`${i18nKey}.handleDeprecatedEnvVariables.portalEnvVarDeprecated`, {
        configPath: getConfigFilePath(),
      })
    );
    process.env.HUBSPOT_ACCOUNT_ID = process.env.HUBSPOT_PORTAL_ID;
  }
};

function addConfigEnvironmentVariablesMiddleware(options) {
  const { useEnv, config } = options;

  if (useEnv) {
    process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] = true;
  }

  if (config) {
    process.env[ENVIRONMENT_VARIABLES.HUBSPOT_CONFIG_PATH] = config;
  }
}

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
const injectAccountIdMiddleware = async options => {
  const { account: accountOption } = options;

  // Preserves the original --account flag for certain commands.
  options.providedAccountId = accountOption;

  // Check environment variables for accountId
  if (options.useEnv && process.env[ENVIRONMENT_VARIABLES.HUBSPOT_ACCOUNT_ID]) {
    options.derivedAccountId = parseInt(
      process.env[ENVIRONMENT_VARIABLES.HUBSPOT_ACCOUNT_ID],
      10
    );
    return;
  }

  // If not using environment variables, check if provided account exists
  if (accountOption) {
    const account = getConfigAccountIfExists(accountOption);
    if (account) {
      options.derivedAccountId = account.accountId;
    } else {
      logger.error(
        i18n(`${i18nKey}.injectAccountIdMiddleware.accountNotFound`, {
          accountIdentifier: accountOption,
          authCommand: uiCommandReference('{authCommand}'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  // If no provided account or environment variable, use the default account
  try {
    const defaultAccount = getConfigDefaultAccount();
    options.derivedAccountId = defaultAccount.accountId;
  } catch (e) {}
};

const validateConfigMiddleware = async options => {
  // Skip this when no command is provided
  if (!options._.length) {
    return;
  }

  const maybeValidateConfig = () => {
    if (
      !isTargetedCommand(options, SKIP_CONFIG_VALIDATION) &&
      !isConfigValid()
    ) {
      process.exit(EXIT_CODES.ERROR);
    }
  };

  if (globalConfigFileExists() && options.config) {
    logger.error(
      i18n(`${i18nKey}.loadConfigMiddleware.configFileExists`, {
        configPath: getConfigFilePath(),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (!isTargetedCommand(options, { init: { target: true } })) {
    // We don't run isConfigValid() for auth because users should be able to run it when
    // no accounts are configured, but we still want to exit if the config file is not found
    if (isTargetedCommand(options, { auth: { target: true } }) && !config) {
      process.exit(EXIT_CODES.ERROR);
    }
  }

  maybeValidateConfig();
};

const checkAndWarnGitInclusionMiddleware = options => {
  // Skip this when no command is provided
  if (!options._.length) {
    return;
  }
  checkAndWarnGitInclusion(getConfigPath());
};

const accountsSubCommands = {
  target: false,
  subCommands: {
    clean: { target: true },
    list: { target: true },
    ls: { target: true },
    remove: { target: true },
  },
};

const sandboxesSubCommands = {
  target: false,
  subCommands: {
    delete: { target: true },
  },
};

const SKIP_ACCOUNT_VALIDATION = {
  init: { target: true },
  auth: { target: true },
  account: accountsSubCommands,
  accounts: accountsSubCommands,
  sandbox: sandboxesSubCommands,
  sandboxes: sandboxesSubCommands,
};

const validateAccountOptions = async options => {
  // Skip this when no command is provided
  if (!options._.length) {
    return;
  }

  let validAccount = true;
  if (!isTargetedCommand(options, SKIP_ACCOUNT_VALIDATION)) {
    validAccount = await validateAccount(options);
  }

  if (!validAccount) {
    process.exit(EXIT_CODES.ERROR);
  }
};

const argv = yargs
  .usage('The command line interface to interact with HubSpot.')
  .middleware([
    setLogLevel,
    setRequestHeaders,
    addConfigEnvironmentVariablesMiddleware,
    handleDeprecatedEnvVariables,
    validateConfigMiddleware,
    injectAccountIdMiddleware,
    checkAndWarnGitInclusionMiddleware,
    validateAccountOptions,
  ])
  .exitProcess(false)
  .fail(handleFailure)
  .option('noHyperlinks', {
    default: false,
    describe: 'prevent hyperlinks from displaying in the ui',
    hidden: true,
    type: 'boolean',
  })
  .option('noColor', {
    default: false,
    describe: 'prevent color from displaying in the ui',
    hidden: true,
    type: 'boolean',
  })
  .check(performChecks)
  .command(authCommand)
  .command(initCommand)
  .command(logsCommand)
  .command(cmsCommand)
  .command(lintCommand)
  .command(hubdbCommand)
  .command(watchCommand)
  .command(removeCommand)
  .command(uploadCommand)
  .command(createCommand)
  .command(fetchCommand)
  .command(filemanagerCommand)
  .command(secretCommands)
  .command(customObjectCommand)
  .command(functionCommands)
  .command({
    ...listCommand,
    aliases: 'ls',
  })
  .command(openCommand)
  .command(mvCommand)
  .command(projectCommands)
  .command(themeCommand)
  .command(moduleCommand)
  .command(configCommand)
  .command(accountCommands)
  .command(sandboxesCommand)
  .command(feedbackCommand)
  .command(doctorCommand)
  .command(completionCommand)
  .help()
  .alias('h', 'help')
  .recommendCommands()
  .demandCommand(1, '')
  .wrap(getTerminalWidth())
  .strict().argv;

if (argv.help) {
  trackHelpUsage(getCommandName(argv));
}

if (argv.convertFields) {
  trackConvertFieldsUsage(getCommandName(argv));
}
