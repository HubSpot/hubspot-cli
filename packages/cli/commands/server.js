#!/usr/bin/env node
const path = require('path');
const shell = require('shelljs');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { getCwd } = require('@hubspot/cli-lib/path');

const { version } = require('../package.json');
const { updateServerContext } = require('../lib/server/updateContext');

const {
  addConfigOptions,
  addLoggerOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.server';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

function configureServerCommand(program) {
  program
    .version(version)
    .description(i18n(`${i18nKey}.description`))
    .option('--serverConfig <serverConfig>')
    .option('--contextDir [contextDir]')
    .arguments('<src>')
    .action(async (src, options) => {
      setLogLevel(options);
      logDebugInfo(options);
      const { config: configPath, serverConfig, contextDir } = options;
      loadConfig(configPath, options);
      checkAndWarnGitInclusion();

      if (!validateConfig()) {
        process.exit(EXIT_CODES.ERROR);
      }

      const accountId = getAccountId(options);

      // TODO: add flag to bypass
      logger.log(i18n(`${i18nKey}.fetching`, { accountId }));
      await updateServerContext(accountId, path.join(getCwd(), contextDir));

      const cwd = getCwd();
      const cmd = `
    docker run -p 8080:8080 \
    -v ${cwd}/${src}:/local-cms-server/${src} \
    -v ${cwd}/${contextDir}:/local-cms-server/${contextDir} \
    -v ${cwd}/${serverConfig}:/local-cms-server/${serverConfig} \
    hubspot/local-cms-server
  `;

      logger.log(i18n(`${i18nKey}.startingServer`));
      logger.debug(
        i18n(`${i18nKey}.runningServer`, {
          cmd,
        })
      );
      shell.exec(cmd, { async: true });
    });

  addLoggerOptions(program);
  addAccountOptions(program);
  addConfigOptions(program);
  addUseEnvironmentOptions(program);
}

module.exports = {
  configureServerCommand,
};
